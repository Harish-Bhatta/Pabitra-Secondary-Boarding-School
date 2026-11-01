PSBS site – structure
  *.html            page markup only (boot veil + theme-init stay inline on purpose)
  assets/css/       per-page stylesheets in the original cascade order; adjacent patch layers are merged into *-bundle-N.css (each layer is marked by a "/* ===== name ===== */" header)
  assets/js/        per-page scripts, in the original execution order
  assets/shared/    blocks that were identical on several pages (edit once)
Keep the folder layout when uploading; the HTML links to assets/ by relative path.
To change one page's look, edit its file in assets/css/. Patch layers are still
separate files (psbs-*.css), so each can be reviewed and merged away individually.

No autofill: assets/shared/no-autofill.js (loaded first in every page) sets autocomplete=off on all forms and fields, including ones created later.
