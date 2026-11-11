const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
for(const [file,name]of [['original-runtime','initializeOriginal'],['contact-runtime','initializeContact'],['experience-runtime','initializeExperience'],['catalogue-runtime','applyCatalogue']]){
 const source=fs.readFileSync(path.join(root,'lib/'+file+'.js'),'utf8').replace(/^\uFEFF/,'').replace('export function '+name,'function '+name);
 fs.writeFileSync(path.join(root,'lib/'+file+'-source.json'),JSON.stringify({script:'('+source+')'}));
}
