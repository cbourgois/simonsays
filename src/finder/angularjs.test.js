import proxyquire from 'proxyquire';
import sinon from 'sinon';
import test from 'ava';

const globMock = sinon.stub().yields();
globMock.withArgs('source/**/*.js').resolves(['awesome.js']);

const readFileSyncStub = sinon.stub();
readFileSyncStub.withArgs('awesome.js', 'utf8').returns('angular.module("awesome", ["required"]); // ');

const fsStub = {
  readFileSync: readFileSyncStub,
};

const AngularJSFinder = proxyquire(
  './angularjs',
  {
    'fs-extra': fsStub,
    'glob-promise': globMock,
  },
);

test('should detect module', async (t) => {
  const angularJSFinder = new AngularJSFinder('source');
  const results = await angularJSFinder.findModulesPath();
  t.deepEqual(results, [{
    path: '.',
    exclude: [],
  }]);
});
