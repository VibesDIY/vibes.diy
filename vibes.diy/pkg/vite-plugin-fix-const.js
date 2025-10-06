/**
 * Vite plugin to fix @adviser/cement const reassignment issue
 * Replaces 'const cr=' with 'let cr=' in the final bundle
 */

export function fixConstReassignment() {
  return {
    name: 'fix-const-reassignment',
    generateBundle(options, bundle) {
      // Process all JS chunks in the bundle
      Object.keys(bundle).forEach(fileName => {
        const chunk = bundle[fileName];
        
        if (chunk.type === 'chunk' && chunk.fileName.endsWith('.js')) {
          const originalCode = chunk.code;
          
          // Replace const declarations that contain dr, which gets reassigned later
          // Pattern: const kh={...},dr=kh; -> let kh={...},dr=kh;
          chunk.code = chunk.code.replace(/const ([^;]*,dr=[^;]*;)/g, 'let $1');
          
          // Also handle other potential cement const patterns
          chunk.code = chunk.code.replace(/const (dr|cr|er|fr|gr|hr|ir|jr|kr|lr|mr|nr|or|pr|qr|rr|sr|tr|ur|vr|wr|xr|yr|zr)=/g, 'let $1=');
          
          if (chunk.code !== originalCode) {
            console.log(`🔧 Fixed const reassignments in ${fileName}`);
          }
        }
      });
    }
  };
}