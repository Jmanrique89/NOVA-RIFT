const fs=require("fs");
const parser=require("@babel/parser");
const traverse=require("@babel/traverse").default;
const TEXTY=new Set(["Text","Animated.Text","RNText","ThemedText","AppText","Tspan","TSpan","TextPath"]);
function tagName(node){const n=node.openingElement?node.openingElement.name:node.name;if(!n)return"?";if(n.type==="JSXIdentifier")return n.name;if(n.type==="JSXMemberExpression")return(n.object.name||"?")+"."+(n.property.name||"?");return"?";}
const NUL=String.fromCharCode(0);
for(const f of process.argv.slice(2)){
  let code;try{code=fs.readFileSync(f,"utf8");}catch(e){console.log("SKIP "+f);continue;}
  const i=code.indexOf(NUL);let trunc=false;if(i>=0){code=code.slice(0,i);trunc=true;}
  console.error("scan "+f+" len="+code.length+(trunc?" NUL-trim":""));
  let ast;try{ast=parser.parse(code,{sourceType:"module",errorRecovery:true,plugins:["jsx","typescript","classProperties"]});}catch(e){console.log("HARDFAIL "+f+": "+e.message.split("\n")[0]);continue;}
  try{traverse(ast,{
    JSXElement(p){const t=tagName(p.node);if(TEXTY.has(t))return;for(const ch of p.node.children){
      if(ch.type==="JSXText"&&ch.value.trim())console.log(f+":"+ch.loc.start.line+": BARE-TEXT <"+t+"> => \""+ch.value.trim().slice(0,50)+"\"");
      if(ch.type==="JSXExpressionContainer"&&ch.expression){const e=ch.expression;
        if(e.type==="StringLiteral")console.log(f+":"+ch.loc.start.line+": STRING <"+t+"> => \""+e.value.slice(0,50)+"\"");
        if(e.type==="TemplateLiteral")console.log(f+":"+ch.loc.start.line+": TEMPLATE <"+t+">");
        if(e.type==="NumericLiteral")console.log(f+":"+ch.loc.start.line+": NUMBER <"+t+"> => "+e.value);}}},
    JSXFragment(p){for(const ch of p.node.children){
      if(ch.type==="JSXText"&&ch.value.trim())console.log(f+":"+ch.loc.start.line+": BARE-TEXT <Fragment> => \""+ch.value.trim().slice(0,50)+"\"");
      if(ch.type==="JSXExpressionContainer"&&ch.expression&&ch.expression.type==="StringLiteral")console.log(f+":"+ch.loc.start.line+": STRING <Fragment> => \""+ch.expression.value.slice(0,50)+"\"");}}
  });}catch(e){console.log("TRAVFAIL "+f+": "+e.message.split("\n")[0]);}
}
console.log("=== done ===");
