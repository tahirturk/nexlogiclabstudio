export type Word={start:number;end:number;word:string};
export type Segment={start:number;end:number;text:string;words?:Word[]};
export function segmentLines(source:Segment[],min:number,max:number):Segment[]{
 const split:Segment[]=[];
 for(const seg of source){if(max>0&&seg.words?.length){let words:Word[]=[];for(const w of seg.words){if(words.length&&w.end-words[0].start>max){split.push({start:words[0].start,end:words.at(-1)!.end,text:words.map(x=>x.word).join(' ').replace(/\s+/g,' ').trim(),words});words=[]}words.push(w)}if(words.length)split.push({start:words[0].start,end:words.at(-1)!.end,text:words.map(x=>x.word).join(' ').replace(/\s+/g,' ').trim(),words})}else split.push({...seg})}
 const result:Segment[]=[];let pending:Segment|undefined;
 for(const s of split){if(!pending){pending={...s};continue}if(pending.end-pending.start<min&&(!max||s.end-pending.start<=max)){pending={start:pending.start,end:s.end,text:pending.text+' '+s.text,words:[...(pending.words||[]),...(s.words||[])]}}else{result.push(pending);pending={...s}}}if(pending)result.push(pending);return result;
}
export function stamp(s:number,sub=false){const n=Math.max(0,Math.round(s*1000));return `${String(Math.floor(n/3600000)).padStart(2,'0')}:${String(Math.floor(n/60000)%60).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')}${sub?',':'.'}${String(n%1000).padStart(3,'0')}`}
export function subtitles(lines:Segment[],format:'srt'|'vtt'){return (format==='vtt'?'WEBVTT\n\n':'')+lines.map((s,i)=>`${format==='srt'?i+1+'\n':''}${stamp(s.start,format==='srt')} --> ${stamp(s.end,format==='srt')}\n${s.text.trim()}\n`).join('\n')}
