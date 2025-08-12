// Foundation types for a template instance returned by the LLM.

export interface LayoutBase<I extends string> {
  id: I;
}

export interface Parent<I extends string> extends LayoutBase<I> {
  children: LayoutBase<string>[];
}

export interface TextContent<I extends string> extends LayoutBase<I> {
  content: string;
}

export interface QueryPrompt {
  queryId: string;
  queryContent: string;
}

export interface QueryResponder<I extends string>
  extends LayoutBase<I>,
  QueryPrompt { }

export interface QueryableParent<I extends string> extends LayoutBase<I> {
  children: QueryPrompt[];
}
