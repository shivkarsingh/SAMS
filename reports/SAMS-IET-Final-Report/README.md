# SAMS IET Final Report

This folder contains the editable LaTeX source and compiled PDF for the Smart Attendance Management System final project report.

## Main Files

- `main.tex` - report entry point
- `title.tex` - IET-style title page with editable placeholders
- `Chapters/` - chapter source files
- `Appendices/Appendix.tex` - setup, API and model reference
- `Images/` - report images and architecture diagram
- `main.pdf` - compiled report PDF

## Build

The PDF was compiled with Tectonic through the temporary Node package `node-latex-compiler`, because a full local TeX distribution was not available on this machine.

From this folder, the same build can be repeated with:

```bash
node - <<'NODE'
const { compile } = require('/tmp/sams-latex-compiler/node_modules/node-latex-compiler');
(async () => {
  const result = await compile({
    texFile: 'main.tex',
    outputDir: '.',
    outputFile: 'main.pdf'
  });
  if (result.status !== 'success') {
    console.error(result.stderr || result.error || 'compile failed');
    process.exit(1);
  }
  console.log(result.pdfPath);
})();
NODE
```

If `/tmp/sams-latex-compiler` has been deleted, reinstall the helper outside the repo:

```bash
mkdir -p /tmp/sams-latex-compiler
npm install --prefix /tmp/sams-latex-compiler node-latex-compiler
```

The report uses sanitized configuration examples only. Do not add real database URIs, SMTP passwords, API keys or app passwords to the report.
