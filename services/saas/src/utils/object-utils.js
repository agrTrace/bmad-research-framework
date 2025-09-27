function toCamelCase(input) {
  if (!input) return input;
  return String(input)
    .replace(/[-_]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ''))
    .replace(/^(.)/, (match) => match.toLowerCase());
}

function sortByLocale(items, selector) {
  return [...items].sort((a, b) => {
    const aValue = selector(a) ?? '';
    const bValue = selector(b) ?? '';
    return String(aValue).localeCompare(String(bValue), 'zh-Hans-CN-u-co-pinyin');
  });
}

module.exports = {
  toCamelCase,
  sortByLocale,
};
