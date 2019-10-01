import proxyquire from 'proxyquire';
import sinon from 'sinon';
import test from 'ava';

const globMock = sinon.stub();

globMock
  .withArgs('source/**/*.html', { ignore: [] })
  .resolves(['source/a.html']);

const readFileSync = sinon.stub();
readFileSync
  .withArgs('source/a.html', 'utf8')
  .returns(`
<div>
  <p data-translate="hello_world"></p>
  
  <a href="">{{ 'link' | translate }}</a>

  <a href="">{{ ('link_' + $ctrl.linkTitle) | translate }}</a>
  <a href="">{{ ('link_' + $ctrl.linkTitle + '_second' ) | translate }}</a>
</div>
`);

const fsStub = {
  readFileSync,
};

const HtmlParser = proxyquire(
  './html',
  {
    'fs-extra': fsStub,
    'glob-promise': globMock,
  },
);

test('should parse translations in html files', async (t) => {
  const htmlParser = new HtmlParser({ path: 'source', exclude: [] });
  const results = await htmlParser.execute();

  const expected = [
    'hello_world',
    'link',
    'link_*',
    'link_*_second',
  ];

  t.deepEqual(results.sort(), expected.sort());
});
