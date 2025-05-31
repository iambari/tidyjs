import { formatImports } from './src/formatter';
import { Config } from './src/types';
import * as fs from 'fs';

async function testFormatting() {
  try {
    const testFile = '/Users/belkicasmir/Documents/GitHub/tidyjs/test/fixtures/test/09-complex-multiline.tsx';
    const content = fs.readFileSync(testFile, 'utf8');
    
    console.log('Original file length:', content.length);
    
    const config: Config = {
      groups: [
        { name: 'Misc', order: 0, isDefault: true },
        { name: '@app/services', order: 10, isDefault: false, match: /^@app\/services/ }
      ],
      importOrder: { sideEffect: 0, default: 1, named: 2, typeOnly: 3 },
      format: { onSave: false }
    };
    
    // First format
    const result1 = await formatImports(content, config);
    
    console.log('First format - Error:', result1.error);
    console.log('First format - Length:', result1.text.length);
    
    // Second format
    const result2 = await formatImports(result1.text, config);
    
    console.log('Second format - Error:', result2.error);
    console.log('Second format - Length:', result2.text.length);
    console.log('Files are identical:', result1.text === result2.text);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testFormatting();