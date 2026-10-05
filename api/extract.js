const PROMPT=`Image 1 is a Distro table (Processor rows, task columns with quantities). Image 2 is a table of Tasks with AVE MINS.
Extract ONLY what is written. Never invent, guess or change any name or number. Keep exact spelling and capitalization. If something is unclear use the string "[UNCLEAR]" instead of guessing.
Ignore the TOTAL row, the FTE column and any Assigned Account column in image 1.
Return ONLY JSON, no markdown, in this shape:
{"distroTasks":["task header exactly as written in image 1, left to right"],
"averages":[{"task":"name from image 2","mins":number}],
"processors":[{"name":"processor name","quantities":[{"task":"header from image 1","qty":number}]}]}
List only cells that actually contain a number in quantities. Keep processors in the order shown.`;

module.exports=async(req,res)=>{
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});
  const need=process.env.APP_PASSWORD;
  if(need&&req.headers["x-access-code"]!==need)return res.status(401).json({error:"Wrong or missing access code"});
  const key=process.env.ANTHROPIC_API_KEY;
  if(!key)return res.status(500).json({error:"ANTHROPIC_API_KEY is not set on the server"});
  const imgs=req.body&&req.body.images;
  if(!Array.isArray(imgs)||imgs.length!==2||imgs.some(x=>typeof x!=="string"))return res.status(400).json({error:"Send exactly 2 images"});
  const content=[];
  imgs.forEach((data,i)=>{
    content.push({type:"text",text:"Image "+(i+1)+":"});
    content.push({type:"image",source:{type:"base64",media_type:"image/jpeg",data}});
  });
  content.push({type:"text",text:PROMPT});
  try{
    const r=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"},
      body:JSON.stringify({model:process.env.MODEL||"claude-sonnet-5-5",max_tokens:4000,messages:[{role:"user",content}]})
    });
    const j=await r.json();
    if(!r.ok)return res.status(502).json({error:(j.error&&j.error.message)||"API error"});
    const t=(j.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").replace(/```json|```/g,"").trim();
    try{return res.status(200).json(JSON.parse(t))}
    catch(e){return res.status(502).json({error:"Could not parse the answer, try again"})}
  }catch(e){return res.status(502).json({error:"Could not reach the API"})}
};
