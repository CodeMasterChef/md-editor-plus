export type DefaultView = 'markdown' | 'notion';

export function shouldAutoOpenNotion(opts: {
  isMarkdown: boolean;
  defaultView: DefaultView;
  uriKey: string;
  forcedText: ReadonlySet<string>;
}): boolean {
  return (
    opts.isMarkdown &&
    opts.defaultView === 'notion' &&
    !opts.forcedText.has(opts.uriKey)
  );
}
