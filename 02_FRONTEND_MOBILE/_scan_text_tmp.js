const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// Elementos host de RN que SÍ aceptan texto crudo
const TEXT_OK = new Set(['Text','tspan','TSpan','textPath','TextPath','animated.Text']);
// nombres que terminan en Text se consideran tipo-texto (NovaText, AppText...)
const isTextLike = (n) => !!n && (TEXT_OK.has(n) || /Text$/.test(n));

function elName(node){
  const n = node.openingElement && node.openingElement.name;
  if(!n) return null;
  if(n.type==='JSXIdentifier') return n.name;
  if(n.type==='JSXMemberExpression') return (n.object.name||'')+'.'+(n.property.name||'');
  return null;
}

function scan(file){
  const code = fs.readFileSync(file,'utf8');
  let ast;
  try{ ast = parser.parse(code,{sourceType:'module',plugins:['jsx','classProperties','optionalChaining','nullishCoalescingOperator']}); }
  catch(e){ console.log('PARSE FAIL',file,e.message); return; }
  const hits=[];
  traverse(ast,{
    JSXElement(p){
      const name = elName(p.node);
      if(isTextLike(name)) return; // dentro de Text, ok
      for(const child of p.node.children){
        // 1) Texto plano no vacío
        if(child.type==='JSXText'){
          if(child.value.trim().length>0){
            hits.push([child.loc.start.line, name, 'RAW TEXT: '+JSON.stringify(child.value.trim().slice(0,40))]);
          }
        }
        // 2) Expresión que puede dar string/number suelto
        if(child.type==='JSXExpressionContainer'){
          const e = child.expression;
          if(!e) continue;
          if(e.type==='StringLiteral'){
            hits.push([child.loc.start.line, name, 'STRING EXPR: '+JSON.stringify(e.value.slice(0,40))]);
          } else if(e.type==='TemplateLiteral'){
            hits.push([child.loc.start.line, name, 'TEMPLATE LITERAL child']);
          } else if(e.type==='LogicalExpression' && (e.operator==='&&')){
            // cond && <string|template|number>
            const r=e.right;
            if(r.type==='StringLiteral'||r.type==='TemplateLiteral'){
              hits.push([child.loc.start.line, name, 'cond && STRING']);
            } else if(r.type==='NumericLiteral'){
              hits.push([child.loc.start.line, name, 'cond && NUMBER']);
            }
          } else if(e.type==='ConditionalExpression'){
            const cons=e.consequent, alt=e.alternate;
            const bad = (x)=> x && (x.type==='StringLiteral'||x.type==='TemplateLiteral'||x.type==='NumericLiteral');
            if(bad(cons)||bad(alt)){
              hits.push([child.loc.start.line, name, 'ternary -> string/number child']);
            }
          }
        }
      }
    }
  });
  if(hits.length){
    console.log('\n### '+path.relative(process.cwd(),file));
    hits.forEach(h=>console.log('  L'+h[0]+'  <'+h[1]+'>  '+h[2]));
  }
}

function walk(dir){
  for(const f of fs.readdirSync(dir)){
    const fp=path.join(dir,f);
    const st=fs.statSync(fp);
    if(st.isDirectory()){ if(f==='node_modules'||f==='__tests__') continue; walk(fp); }
    else if(/\.(js|jsx)$/.test(f)) scan(fp);
  }
}
walk(path.join(process.cwd(),'src'));
scan(path.join(process.cwd(),'App.js'));
console.log('\n--- scan done ---');
