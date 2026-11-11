import original from "./connect-original.json";
import recovered from "./recovered-services.json";
import type { PublicChannels } from "./channels";
import type { Service } from "./domain";
import { catalogueChoice, visibleCatalogue } from "./catalogue-tree";
import runtimeSource from "./original-runtime-source.json";
import contactSource from "./contact-runtime-source.json";
import experienceSource from "./experience-runtime-source.json";
import {termsSettings,assistantAvailable} from "./app-access";
import catalogueSource from "./catalogue-runtime-source.json";

type Options = {
  services?: Service[];
  slug?: string;
  point?: string | null;
  demo?: boolean;
};
export function inlineJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
export function mobileCatalogue(services: Service[]) {
  return visibleCatalogue(services).map((s) => {
    const known = recovered.find(
      (r) =>
        r.name.normalize("NFC").toLowerCase() ===
        s.name.normalize("NFC").toLowerCase(),
    );
    const legacyGroup =
      s.subcategory === "RECOVERY"
        ? "recuperacion"
        : s.subcategory === "GLOW"
          ? "dermoestetica"
          : s.category === "SEGUIMIENTO"
            ? "seguimiento"
            : ["CHECK", "BODY", "VITA"].includes(s.category)
              ? "evaluacion"
              : s.subcategory === "SUPLE"
                ? "suple"
                : s.category === "COMPRENDE"
                  ? "comprende"
                  : "interpretacion";
    const type = s.catalog_type ?? "service";
    const sourceId =
      known?.source_id ??
      (["CHECK", "BODY", "VITA"].includes(s.name.toUpperCase())
        ? s.name.toLowerCase()
        : null);
    const choice = catalogueChoice(s);
    return {
      selectionTitle: choice.title,
      selectionDescription: choice.description,
      selectionOrder: choice.order,
      id: s.id,
      type,
      parentId: s.parent_id ?? null,
      sourceId,
      legacyGroup,
      group: s.parent_id ? "g-" + s.parent_id : "individual",
      route:
        type === "group"
          ? "/servicios/g-" + s.id
          : "/servicios/" +
            (s.parent_id ? "g-" + s.parent_id : "individual") +
            "/" +
            s.id,
      name: s.name,
      description: s.description,
      actionUrl: s.action_url ?? "",
      actionLabel: s.action_label ?? "",
    };
  });
}
export function originalConnectHtml(
  channels: PublicChannels,
  options: Options = {},
) {
  const destinations = {
    novogen: channels.website_url,
    instagram: channels.instagram_url,
    tiktok: channels.tiktok_url,
    youtube: channels.youtube_url,
    whatsapp: channels.whatsapp_url,
    agenda: channels.agenda_url,
  };
  let html = original.html.replace(
    /const st=\{novogen:[\s\S]*?\},Jn=/,
    () => `const st=${inlineJson(destinations)},Jn=`,
  );
  if (options.services) {
    const catalogue = mobileCatalogue(options.services);
    if (!html.includes("function R0()"))
      throw new Error("La versión original cambió: revisar adaptador");
    const patch = `${catalogueSource.script}(md,Zv,Yv,Pl,st,${inlineJson(catalogue)});Ql.splice(0,Ql.length);zv.push({clave:"youtube",nombre:"YouTube",Icono:connectYoutubeIcon});function connectYoutubeIcon(props){return i.jsxs("svg",{...props,viewBox:"0 0 24 24","aria-hidden":true,children:[i.jsx("rect",{x:2,y:5,width:20,height:14,rx:5,fill:"currentColor"}),i.jsx("path",{d:"M10 8.5L16 12L10 15.5Z",fill:"#ff0033"})]})}`;
    html = html.replace("function R0()", () => patch + "function R0()");
    html = html.replace(
      "descripcion:L,color:z})=>",
      "descripcion:L,color:z,destino:connectDestination,selectionTitle:connectSelection,selectionDescription:connectChoiceDescription,hideCommercialLabel:connectHideBrand})=>",
    );
    html = html.replace(
      "to:`${o.ruta}/${j}`,compacta:f>1",
      "to:connectDestination??`${o.ruta}/${j}`,compacta:f>1",
    );
    html = html.replace(
      "marca:w,titulo:_,tituloCorto:A,descripcion:L,color:z,icono:",
      "marca:connectHideBrand?void 0:w,titulo:connectSelection??_,tituloCorto:A,descripcion:connectChoiceDescription??L,color:z,icono:",
    );
    html = html.replace(
      "s.servicios.find(d=>d.id===u)",
      's.servicios.find(d=>d.catalogType!=="group"&&(d.id===u||d.sourceId===u))',
    );
    const listStart = html.indexOf("function l0(");
    const listEnd = html.indexOf("function ", listStart + 10);
    if (listStart >= 0 && listEnd > listStart) {
      const list = html
        .slice(listStart, listEnd)
        .replace('to:"/servicios"', 'to:o.parentRoute??"/servicios"')
        .replace('children:"SERVICIOS"', 'children:o.parentLabel??"SERVICIOS"');
      html = html.slice(0, listStart) + list + html.slice(listEnd);
    }
    html = html.replace("ee=u.ctaFicha", "ee=o.ctaFicha??u.ctaFicha");
    const originalCta = "i.jsx(ln,{href:st[ee.enlace],label:ee.etiqueta}),k&&";
    html = html.replace(
      originalCta,
      'i.jsx(ln,{href:st[ee.enlace],label:ee.etiqueta}),i.jsx("button",{type:"button",className:"connect-contact-button","data-connect-request":o.id,children:"Solicitar orientación"}),o.actionUrl&&i.jsx("a",{className:"connect-product-link",href:o.actionUrl,target:"_blank",rel:"noopener noreferrer","data-connect-target":"store",children:o.actionLabel||"Ver productos"}),k&&',
    );
    const style =
      "<style>.social__item--youtube{background:#ff0033;box-shadow:0 0 26px -8px #ff0033cc}.connect-product-link{display:inline-flex;align-self:center;align-items:center;justify-content:center;min-height:44px;max-width:220px;padding:9px 18px;border:1px solid #3186a7;border-radius:999px;background:#072440;color:#7de4ff;font-size:12px;font-weight:600;line-height:1.4;text-decoration:none}.connect-product-link:hover{border-color:#6cddff;background:#103655}</style>";
    html = html.replace("</head>", () => style + "</head>");
    const runtime = {
      slug: options.slug ?? "novogen",
      point: options.point ?? null,
      demo: options.demo ?? false,
      catalogue,
      channels,
      terms:termsSettings(),
      assistantAvailable:(options.slug ?? "novogen") === "novogen" && assistantAvailable(),
      orientationMode:"documental",
      orientationEmbedUrl:"https://www.novogensalud.cl/?orientame_embed=1",
    };
    html = html.replace(
      "</body>",
      () =>
        `<script>${runtimeSource.script}(${inlineJson(runtime)});${contactSource.script}(${inlineJson(runtime)});${experienceSource.script}(${inlineJson(runtime)});</script></body>`,
    );
  }
  return html;
}
