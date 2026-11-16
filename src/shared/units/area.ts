// Geometry stays in centimetres; surface measurements display in square metres.
export function formatArea(areaCm2: number) {
  return `${(areaCm2 / 10000).toLocaleString(undefined, { maximumFractionDigits: 4 })} m²`;
}
