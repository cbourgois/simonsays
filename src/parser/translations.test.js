import proxyquire from 'proxyquire';
import sinon from 'sinon';
import test from 'ava';

const globMock = sinon.stub();

globMock
  .withArgs('source/**/Messages_fr_FR.@(json|xml)', { ignore: [] })
  .resolves(['source/profile.json', 'source/account.xml']);

const readFileSync = sinon.stub();
readFileSync
  .withArgs('source/profile.json', 'utf8')
  .returns('{"profile_title_json": "{{nickname}} profile"}');
readFileSync
  .withArgs('source/account.xml', 'utf8')
  .returns(`<?xml version="1.0" encoding="utf-8"?>
<translations>
  <translation id="login_label">LOGIN "{{ name }}"</translation>
  <translation id="logout_label">LOGOUT "{{ name }}"</translation>
</translations>`);

const fsStub = {
  readFileSync,
};

const TranslationsParser = proxyquire(
  './translations',
  {
    'fs-extra': fsStub,
    'glob-promise': globMock,
  },
);

test('should parse translations', async (t) => {
  const translationParser = new TranslationsParser({ path: 'source', exclude: [] }, 'fr_FR');
  const results = await translationParser.execute();
  t.deepEqual(results, {
    profile_title_json: '{{nickname}} profile',
    login_label: 'LOGIN "{{ name }}"',
    logout_label: 'LOGOUT "{{ name }}"',
  });
});
