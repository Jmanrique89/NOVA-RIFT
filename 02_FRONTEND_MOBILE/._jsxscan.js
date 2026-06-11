const fs=require("fs");
const parser=require("@babel/parser");
const traverse=require("@babel/traverse").default;
const TEXTY=new Set(["Text","Animated.Text","RNText","ThemedText","AppText","Tspan","TSpan","TextPath"]);
function tagName(node){
  const n=node.openingElement?node.openingElement.name:node.name;
  if(!n) return "?";
  if(n.type==="JSXIdentifier") return n.name;
  if(n.type==="JSXMemberExpression") return (n.object.name||"?")+"."+(n.property.name||"?");
  return "?";
}
const files=process.argv.slice(2);
for(const f of files){
  let code; try{code=fs.readFileSync(f,"utf8");}catch(e){console.log("SKIP "+f);continue;}
  let ast;
  try{ ast=parser.parse(code,{sourceType:"module",plugins:["jsx","typescript","classProperties","objectRestSpread"]}); }
  catch(e){ console.log("PARSEFAIL "+f+": "+e.message.split("\n")[0]); continue; }
  traverse(ast,{
    JSXElement(path){
      const parentTag=tagName(path.node);
      if(TEXTY.has(parentTag)) return;
      for(const child of path.node.children){
        if(child.type==="JSXText" && child.value.trim().length>0)
          console.log(f+":"+child.loc.start.line+":  BARE-TEXT under <"+parentTag+">  => \""+child.value.trim().slice(0,60)+"\"");
        if(child.type==="JSXExpressionContainer"){
          const e=child.expression;
          if(e.type==="StringLiteral")
            console.log(f+":"+child.loc.start.line+":  STRING-EXPR under <"+parentTag+">  => \""+e.value.slice(0,60)+"\"");
          if(e.type==="TemplateLiteral")
            console.log(f+":"+child.loc.start.line+":  TEMPLATE-EXPR under <"+parentTag+">");
        }
      }
    },
    JSXFragment(path){
      for(const child of path.node.children){
        if(child.type==="JSXText" && child.value.trim().length>0)
          console.log(f+":"+child.loc.start.line+":  BARE-TEXT under <Fragment>  => \""+child.value.trim().slice(0,60)+"\"");
        if(child.type==="JSXExpressionContainer" && child.expression.type==="StringLiteral")
          console.log(f+":"+child.loc.start.line+":  STRING-EXPR under <Fragment>  => \""+child.expression.value.slice(0,60)+"\"");
      }
    }
  });
}
console.log("=== scan complete ===");
