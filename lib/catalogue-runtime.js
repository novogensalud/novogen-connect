// Adapt the recovered FLASH data model without replacing its components or styles.
export function applyCatalogue(md, roots, icons, navigation, channels, rows) {
  const templates = {};
  const originals = { ...md };
  Object.values(md).forEach((group) =>
    (group.servicios || []).forEach((s) => {
      templates[s.id] = s;
    }),
  );
  const aliases = {
    evaluacion: "EVALUACIÓN",
    interpretacion: "OPTIMIZA",
    recuperacion: "RECOVERY",
    dermoestetica: "GLOW",
    suple: "SUPLE",
    seguimiento: "SEGUIMIENTO",
    comprende: "COMPRENDE",
  };
  const sourceGroup = (name) =>
    Object.keys(aliases).find((key) => aliases[key] === name.toUpperCase());
  const colors = {
    evaluacion: "#00c4ff",
    interpretacion: "#02f8c1",
    recuperacion: "#feb60d",
    dermoestetica: "#fc3176",
    suple: "#02f8c1",
    seguimiento: "#00c4ff",
    comprende: "#02f8c1",
  };
  const iconFallback = icons.evaluacion;
  const groups = rows.filter((r) => r.type === "group");
  const definitions = {};
  const rootGroup = {
    id: "individual",
    ruta: "/servicios/individual",
    cabecera: {},
    servicios: [],
    iconos: {},
    volver: "servicios",
    ctaFicha: { etiqueta: "AGENDAR", enlace: "agenda" },
  };
  definitions.individual = rootGroup;
  function entry(row) {
    const color = colors[row.legacyGroup] || "#00c4ff";
    if (row.type === "group")
      return {
        catalogType: "group",
        id: row.id,
        titulo: row.selectionTitle,
        descripcion: row.selectionDescription,
        color,
        destino: row.route,
        selectionTitle:
          row.selectionTitle !== row.name ? row.selectionTitle : null,
        selectionDescription:
          row.selectionTitle !== row.name ? row.selectionDescription : null,
      };
    const old = row.sourceId ? templates[row.sourceId] : null;
    const record = {
      catalogType: "service",
      marca: "NOVOGEN " + row.name,
      color,
      promesa: "",
      obtienesTitulo: "INFORMACIÓN DEL SERVICIO",
      obtienes: [row.description],
      porQue: { titulo: "CONSULTA CON EL EQUIPO", texto: row.description },
      paneles: [],
      recorrido: [],
      aviso: "Consulta disponibilidad y condiciones con NOVOGEN.",
      ...old,
      id: row.id,
      sourceId: row.sourceId,
      titulo: row.name,
      tituloCorto: old?.tituloCorto ?? old?.titulo ?? row.name,
      descripcion: row.description,
      entrada: row.description,
      datos: [],
      destino: row.route,
      hideCommercialLabel: row.selectionTitle !== row.name,
      selectionTitle:
        row.selectionTitle !== row.name
          ? row.selectionTitle
          : (old?.titulo ?? null),
      selectionDescription:
        row.selectionTitle !== row.name ? row.selectionDescription : null,
    };
    if (row.name.toUpperCase() === "SUPLE")
      record.ctaFicha = {
        enlace: "whatsapp",
        etiqueta: "CONSULTAR SOBRE PRODUCTOS",
      };
    if (row.actionUrl) {
      record.actionUrl = row.actionUrl;
      record.actionLabel = row.actionLabel || "Ver productos";
    }
    return record;
  }
  for (const group of groups) {
    const alias = sourceGroup(group.name);
    const previous = originals[alias] || {};
    const key = "g-" + group.id;
    const parent = groups.find((r) => r.id === group.parentId);
    definitions[key] = {
      ...previous,
      id: key,
      ruta: group.route,
      cabecera: {
        lema: "CIENCIA PARA UNA VIDA MEJOR",
        titulo: group.selectionTitle.toUpperCase(),
        entrada: group.selectionDescription,
        guia: ["CONOCER", "EXPLORAR", "ELEGIR"],
      },
      servicios: rows
        .filter((r) => r.parentId === group.id)
        .sort((a, b) => a.selectionOrder - b.selectionOrder)
        .map(entry),
      iconos: {},
      volver: key,
      parentRoute: parent ? parent.route : "/servicios",
      parentLabel: parent ? parent.selectionTitle.toUpperCase() : "SERVICIOS",
      cta: { etiqueta: "IR A NOVOGEN", enlace: "novogen" },
      ctaFicha: { etiqueta: "AGENDAR", enlace: "agenda" },
    };
    delete definitions[key].directa;
    navigation[key] = {
      ruta: group.route,
      etiqueta: group.selectionTitle.toUpperCase(),
    };
    icons[key] = icons[alias] || iconFallback;
    for (const child of rows.filter((r) => r.parentId === group.id))
      definitions[key].iconos[child.id] =
        (originals[child.legacyGroup]?.iconos || {})[child.sourceId] ||
        icons[sourceGroup(child.name)] ||
        iconFallback;
  }
  rootGroup.servicios = rows.filter((r) => r.type === "service").map(entry);
  for (const key of Object.keys(md)) delete md[key];
  Object.assign(md, definitions);
  // Old category/UUID URLs continue to resolve, without rendering a group as a service.
  for (const [alias, name] of Object.entries(aliases)) {
    const group = groups.find((r) => r.name.toUpperCase() === name);
    const previous = originals[alias] || {};
    md[alias] = group
      ? { ...definitions["g-" + group.id] }
      : {
          ...rootGroup,
          ...previous,
          servicios: rows
            .filter((r) => r.type === "service" && r.legacyGroup === alias)
            .map(entry),
        };
    delete md[alias].directa;
  }
  roots.splice(
    0,
    roots.length,
    ...rows
      .filter((r) => !r.parentId)
      .sort((a, b) => a.selectionOrder - b.selectionOrder)
      .map((row) => {
        const key = row.type === "group" ? "g-" + row.id : "s-" + row.id;
        icons[key] = icons[sourceGroup(row.name)] || iconFallback;
        return {
          id: key,
          titulo: row.selectionTitle,
          descripcion: row.selectionDescription,
          color: colors[row.legacyGroup] || "#00c4ff",
          ruta: row.route,
        };
      }),
  );
}
