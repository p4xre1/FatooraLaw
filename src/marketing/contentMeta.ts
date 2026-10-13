/**
 * Dates and entity URLs shared by the visible page, the JSON-LD and the
 * build-time Organization node. Bump `CONTENT_UPDATED` when the public copy
 * changes so `dateModified` and the visible "Mis à jour le …" line agree.
 */
export const CONTENT_PUBLISHED = "2026-01-01"
export const CONTENT_UPDATED = "2026-10-13"

/** Real, owned profile. Do not add a sameAs URL that does not resolve. */
export const GITHUB_URL = "https://github.com/p4xre1/FatooraLaw"

/** Official sources cited on every public page. The sentences quoted from them are short and checked. */
export const SOURCES = {
  dgi: { name: "Direction Générale des Impôts", url: "https://www.tax.gov.ma/" },
  tva: {
    name: "DGI, guide TVA",
    url: "https://www.tax.gov.ma/wps/wcm/connect/689f3a4d-98e4-4bb2-9ba2-d5fdd37c9625/TVA.pdf?MOD=AJPERES",
  },
  cgi: {
    name: "CGI, article 208",
    url: "https://www.tax.gov.ma/wps/portal/DGI/Documentation-fiscale/Code-general-des-impots/Partie3Livre1codegeneraledesimpots/",
  },
  cndp: {
    name: "CNDP, loi 09-08",
    url: "https://www.cndp.ma/traitement-des-donnees-personnelles-au-maroc/",
  },
} as const
