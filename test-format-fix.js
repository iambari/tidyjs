const { formatImports } = require('./dist/formatter.js');
const fs = require('fs');

async function testFormatting() {
  try {
    const testFile = '/Users/belkicasmir/Documents/GitHub/tidyjs/test/fixtures/test/09-complex-multiline.tsx';
    const content = fs.readFileSync(testFile, 'utf8');
    
    console.log('Original file length:', content.length);
    
    // First format
    const result1 = await formatImports(content, {
      groups: [
        { name: 'Misc', order: 0, isDefault: true },
        { name: '@app/services', order: 10, isDefault: false, match: /^@app\/services/ }
      ],
      importOrder: { sideEffect: 0, default: 1, named: 2, typeOnly: 3 },
      format: { onSave: false }
    });
    
    console.log('First format - Error:', result1.error);
    console.log('First format - Length:', result1.text.length);
    
    // Second format
    const result2 = await formatImports(result1.text, {
      groups: [
        { name: 'Misc', order: 0, isDefault: true },
        { name: '@app/services', order: 10, isDefault: false, match: /^@app\/services/ }
      ],
      importOrder: { sideEffect: 0, default: 1, named: 2, typeOnly: 3 },
      format: { onSave: false }
    });
    
    console.log('Second format - Error:', result2.error);
    console.log('Second format - Length:', result2.text.length);
    console.log('Files are identical:', result1.text === result2.text);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testFormatting();