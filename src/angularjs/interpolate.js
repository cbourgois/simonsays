const startSymbol = '{{';
const endSymbol = '}}';
const escapedStartRegexp = new RegExp(startSymbol.replace(/./g, escape), 'g');
const escapedEndRegexp = new RegExp(endSymbol.replace(/./g, escape), 'g');

function escape(ch) {
  return `\\\\\\${ch}`;
}

function unescapeText(text) {
  return text.replace(escapedStartRegexp, startSymbol)
    .replace(escapedEndRegexp, endSymbol);
}

module.exports = function $interpolate(text) {
  // Provide a quick exit and simplified result function for text with no interpolation
  if (!text.length || text.indexOf(startSymbol) === -1) {
    return {
      concat: [],
      expressions: [],
      literal: text,
    };
  }

  // allOrNothing = !!allOrNothing;
  let startIndex;
  let endIndex;
  let index = 0;
  const expressions = [];
  const parseFns = [];
  const textLength = text.length;
  let exp;
  const concat = [];
  const expressionPositions = [];
  const startSymbolLength = startSymbol.length;
  const endSymbolLength = endSymbol.length;

  while (index < textLength) {
    if (((startIndex = text.indexOf(startSymbol, index)) !== -1)
      && ((endIndex = text.indexOf(endSymbol, startIndex + startSymbolLength)) !== -1)) {
      if (index !== startIndex) {
        concat.push(unescapeText(text.substring(index, startIndex)));
      }
      exp = text.substring(startIndex + startSymbolLength, endIndex);
      expressions.push(exp);
      // parseFns.push($parse(exp, parseStringifyInterceptor));
      index = endIndex + endSymbolLength;
      expressionPositions.push(concat.length);
      concat.push('');
    } else {
      // we did not find an interpolation, so we have to add the remainder to the separators array
      if (index !== textLength) {
        concat.push(unescapeText(text.substring(index)));
      }
      break;
    }
  }
  // console.log({
  //     concat,
  //     expressions,
  //     literal: undefined,
  // });
  return {
    concat,
    expressions,
    literal: undefined,
  };
};
