const fs = require('fs');
const path = require('path');

const prismaSchemaPath = path.join(__dirname, '../prisma/schema.prisma');
const prismaSchema = fs.readFileSync(prismaSchemaPath, 'utf8');

const lines = prismaSchema.split('\n');

let mermaid = 'erDiagram\n';
let currentModel = null;
const relationships = [];

for (let line of lines) {
  line = line.trim();
  if (line.startsWith('model ')) {
    currentModel = line.split(' ')[1];
    mermaid += `  ${currentModel} {\n`;
  } else if (line.startsWith('enum ')) {
    // Treat enums as types too
    currentModel = line.split(' ')[1];
    mermaid += `  ${currentModel} {\n`;
  } else if (line === '}' && currentModel) {
    mermaid += `  }\n`;
    currentModel = null;
  } else if (currentModel && line.length > 0 && !line.startsWith('//') && !line.startsWith('@@')) {
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      let fieldName = parts[0];
      let fieldType = parts[1];
      
      // if fieldType is not a standard type (e.g., String, Int, DateTime, Float, Boolean, Json) and not an enum, it's a relationship
      const isOptional = fieldType.endsWith('?');
      const isArray = fieldType.endsWith('[]');
      
      let baseType = fieldType.replace('?', '').replace('[]', '');
      
      const standardTypes = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Decimal', 'Bytes', 'BigInt'];
      
      // Quick check to see if baseType is another model or enum
      // For simplicity, anything not standard is relation.
      // But actually Prisma enums are not relations in ERD sense usually, they are just types.
      // We'll leave it as relation line for simplicity, or we can just ignore it if we wanted.
      // We will output all.

      if (!standardTypes.includes(baseType) && !lines.some(l => l.trim().startsWith('enum ' + baseType))) {
          // It's a relation.
          if (isArray) {
            relationships.push(`  ${currentModel} ||--o{ ${baseType} : "${fieldName}"`);
          } else {
            relationships.push(`  ${currentModel} }|--|| ${baseType} : "${fieldName}"`);
          }
      } else {
          mermaid += `    ${baseType} ${fieldName}\n`;
      }
    }
  }
}

// deduplicate relationships (mermaid fails if there are duplicate identical relationships sometimes)
const uniqueRels = [...new Set(relationships)];

mermaid += '\n' + uniqueRels.join('\n') + '\n';

const outPath = path.join(__dirname, 'database_erd.md');
fs.writeFileSync(outPath, '```mermaid\n' + mermaid + '```\n');
console.log('ERD generated at ' + outPath);
