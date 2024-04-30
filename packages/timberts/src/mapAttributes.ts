export type AttributeTransformer = (attr: string) => string;
export const mapAttributes =
  (mappers: AttributeTransformer[]) => (attr: string) =>
    mappers.reduce((acc, mapper) => mapper(acc) ?? acc, attr);
