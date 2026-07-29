  return DOMPurify.sanitize(parser.parse(md) as string, {
    FORBID_TAGS,
    FORBID_ATTR,
    ADD_URI_SAFE_ATTR: ['formaction'],
  });