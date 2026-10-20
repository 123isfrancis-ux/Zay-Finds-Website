import {useState} from 'react';
// Remount once with a fresh request, then let the caller show its fallback.
export default function ReliableImage({src,srcSet,onError,...props}) {
 const [retried,setRetried]=useState(null);
 const retrying=retried===src;
 const retrySrc=retrying&&src?src+(src.includes('?')?'&':'?')+'zay_retry=1':src;
 return <img {...props} src={retrySrc} srcSet={retrying?undefined:srcSet} onError={event=>{if(src&&!retrying){setRetried(src);return;}onError?.(event);}}/>;
}
