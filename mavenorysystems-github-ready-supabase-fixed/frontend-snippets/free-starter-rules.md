# Free Starter Frontend Rules

Do not lock modules.
Only limit product capacity.

Free Starter:
- plan = free
- product_limit = 3
- all modules open

Full Planner:
- plan = full
- product_limit = null

Product limit check:

```js
function canAddProduct(profile, products) {
  if (profile.plan === "full") return true;
  const limit = profile.product_limit ?? 3;
  return products.length < limit;
}
```

CSV rule:

```js
function validateCsvImport(profile, existingProducts, importedRows) {
  if (profile.plan === "full") return { ok: true };

  const existingSkus = new Set(existingProducts.map(p => p.sku));
  const importedSkus = new Set(importedRows.map(r => r.sku));
  const mergedSkus = new Set([...existingSkus, ...importedSkus]);

  if (mergedSkus.size > 3) {
    return {
      ok: false,
      message: "Free Starter supports up to 3 products. Upgrade to Full Planner to import and analyze your full shop."
    };
  }

  return { ok: true };
}
```
