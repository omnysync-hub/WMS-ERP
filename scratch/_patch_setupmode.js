const fs = require("fs");
let s = fs.readFileSync("src/components/accounts/AccountMappingTab.tsx", "utf8");

if (!s.includes("if (setupMode) setActiveSubTab")) {
  s = s.replace(
    "useEffect(() => {\n    onCompletenessChange?.(completeness);\n  }, [completeness]);",
    "useEffect(() => {\n    onCompletenessChange?.(completeness);\n  }, [completeness]);\n\n  useEffect(() => {\n    if (setupMode) setActiveSubTab(\"mappings\");\n  }, [setupMode]);"
  );
  // CRLF variant
  s = s.replace(
    "useEffect(() => {\r\n    onCompletenessChange?.(completeness);\r\n  }, [completeness]);",
    "useEffect(() => {\r\n    onCompletenessChange?.(completeness);\r\n  }, [completeness]);\r\n\r\n  useEffect(() => {\r\n    if (setupMode) setActiveSubTab(\"mappings\");\r\n  }, [setupMode]);"
  );
}

const btnMarker = 'onClick={() => setActiveSubTab("suggestions")}';
const idx = s.indexOf(btnMarker);
if (idx > 0 && !s.includes("!setupMode && (")) {
  const btnStart = s.lastIndexOf("<button", idx);
  const btnEnd = s.indexOf("</button>", idx) + "</button>".length;
  if (btnStart >= 0 && btnEnd > btnStart) {
    const btn = s.slice(btnStart, btnEnd);
    s = s.slice(0, btnStart) + "{!setupMode && (" + btn + ")}" + s.slice(btnEnd);
  }
}

// Ensure setupMode is referenced even if button wrap failed
if (!s.includes("setupMode") || (s.match(/\bsetupMode\b/g) || []).length < 3) {
  // already have prop + default; add void reference near return if needed
}

fs.writeFileSync("src/components/accounts/AccountMappingTab.tsx", s);
console.log("done, setupMode count=", (s.match(/\bsetupMode\b/g) || []).length);
