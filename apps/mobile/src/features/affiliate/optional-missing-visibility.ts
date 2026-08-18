export function ingredientsWithoutProductGroups<
  TIngredient extends { name: string },
  TGroup extends { ingredientName: string },
>(ingredients: readonly TIngredient[], productGroups: readonly TGroup[]) {
  const groupedNames = new Set(
    productGroups.map((group) => group.ingredientName.trim()).filter(Boolean),
  );
  const seen = new Set<string>();
  return ingredients.filter((ingredient) => {
    const name = ingredient.name.trim();
    if (!name || groupedNames.has(name) || seen.has(name)) {
      return false;
    }
    seen.add(name);
    return true;
  });
}
