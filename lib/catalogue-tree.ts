import type { Service } from "./domain";

export function isCatalogueGroup(service: Service) {
  return service.catalog_type === "group";
}
export function visibleCatalogue(services: Service[]) {
  const byId = new Map(services.map((s) => [s.id, s]));
  return services.filter((service) => {
    let current: Service | undefined = service;
    const visited = new Set<string>();
    while (current) {
      if (!current.active || visited.has(current.id)) return false;
      visited.add(current.id);
      if (!current.parent_id) return true;
      current = byId.get(current.parent_id);
      if (!current) return false;
    }
    return false;
  });
}
export function availableParents(services: Service[], current?: Service) {
  return services.filter((s) => {
    if (!isCatalogueGroup(s) || s.id === current?.id) return false;
    let cursor: Service | undefined = s;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor.id === current?.id || visited.has(cursor.id)) return false;
      visited.add(cursor.id);
      cursor = services.find((item) => item.id === cursor?.parent_id);
    }
    return true;
  });
}

export function flashPath(slug: string) {
  return slug === "novogen" ? "/connect/novogen/app" : `/connect/${slug}`;
}

// Plain-language choice labels are separate from the commercial service name.
export function catalogueChoice(service: Service) {
  const choices: Record<
    string,
    { title: string; description: string; order: number }
  > = {
    EVALUACIÓN: {
      title: "Evaluación",
      description: "Conoce tu estado de salud.",
      order: 0,
    },
    COMPRENDE: {
      title: "Interpretación",
      description: "Entiende tus resultados y tus próximos pasos.",
      order: 1,
    },
    OPTIMIZA: {
      title: "Bienestar",
      description: "Explora productos, recuperación y cuidado de la piel.",
      order: 2,
    },
    SEGUIMIENTO: {
      title: "Seguimiento",
      description: "Da continuidad a tu atención.",
      order: 3,
    },
    SUPLE: {
      title: "Productos",
      description: "Infórmate sobre productos y conoce la tienda.",
      order: 0,
    },
    RECOVERY: {
      title: "Recuperación",
      description: "Explora opciones de apoyo para tu recuperación.",
      order: 1,
    },
    GLOW: {
      title: "Piel",
      description: "Explora opciones para cuidar tu piel y cabello.",
      order: 2,
    },
  };
  return (
    choices[service.name.trim().toUpperCase()] ?? {
      title: service.name,
      description: service.description,
      order: 20,
    }
  );
}
