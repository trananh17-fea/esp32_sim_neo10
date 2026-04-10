const fs = require('fs');
const paths = ['src/img/favicon.png', 'src/img/logofull.png'];
for (const p of paths) {
  try {
    const buf = fs.readFileSync(p);
    if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      console.log(p + ': not a PNG');
      continue;
    }
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    console.log(`${p}: ${width}x${height}`);
  } catch (err) {
    console.error(`${p}: error ${err.message}`);
  }
}
