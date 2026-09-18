import sharp from 'sharp';
// A baked-in reflection is a vertically MIRRORED, LIGHTER copy of the product's
// lower body. Test both: silhouette symmetry about a split line, and the lower
// half being paler than what it mirrors.
async function detect(file){
  const {data,info}=await sharp(file).ensureAlpha().resize(240,240,{fit:'inside'}).raw().toBuffer({resolveWithObject:true});
  const {width:w,height:h,channels:ch}=info;
  const A=p=>data[p*ch+3], L=p=>(data[p*ch]+data[p*ch+1]+data[p*ch+2])/3;
  const widthAt=y=>{let n=0;for(let x=0;x<w;x++) if(A(y*w+x)>60) n++; return n;};
  const lumaAt=y=>{let s=0,n=0;for(let x=0;x<w;x++){const p=y*w+x; if(A(p)>60){s+=L(p);n++;}} return n?s/n:null;};
  let top=-1,bot=-1;
  for(let y=0;y<h;y++) if(widthAt(y)>0){ if(top<0) top=y; bot=y; }
  if(top<0||bot-top<30) return null;
  const H=bot-top;
  let best=null;
  // split anywhere in the lower 45% of the object
  for(let s=top+Math.round(H*0.55); s<bot-Math.round(H*0.08); s++){
    const span=Math.min(s-top, bot-s);
    if(span<8) continue;
    let num=0,den=0,ok=0;
    for(let d=1; d<=span; d++){
      const a=widthAt(s-d), b=widthAt(s+d);
      if(a===0&&b===0) continue;
      num+=Math.abs(a-b); den+=Math.max(a,b); ok++;
    }
    if(ok<8) continue;
    const symmetry = 1 - num/den;                 // 1 = perfect mirror
    // lightness: mean luma below the split vs above it
    let lu=0,ln=0,uu=0,un=0;
    for(let d=1; d<=span; d++){
      const la=lumaAt(s+d), ua=lumaAt(s-d);
      if(la!=null){lu+=la;ln++;} if(ua!=null){uu+=ua;un++;}
    }
    const lighter = (ln&&un) ? (lu/ln)-(uu/un) : 0;
    const score = symmetry;
    if(!best||score>best.symmetry) best={s,symmetry,lighter,span};
  }
  return best;
}
for (const s of process.argv.slice(2)) {
  const r = await detect(`./public/cutouts/${s}.webp`).catch(()=>null);
  if(!r){ console.log(`  ${s}: (no read)`); continue; }
  const flag = r.symmetry>0.80 && r.lighter>8 ? "  <== REFLECTION" : "";
  console.log(`  sym ${r.symmetry.toFixed(2)}  lighter ${r.lighter.toFixed(1).padStart(6)}   ${s}${flag}`);
}
