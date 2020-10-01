import test from 'ava';

import SimonSays from './simonsays';

test('sourcePath is defined', async (t) => {
  const simonsays = new SimonSays('./test');
  t.deepEqual('./test', simonsays.sourcePath);
});
