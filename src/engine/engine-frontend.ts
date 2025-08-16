// src/engine/engine-frontend.ts
import React, { createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import type {
  TemplatePairs,
  TemplateRegistry,
  TemplateUnion,
} from "../template-utils/template-react-binding";
import type { UserQueryResponsePayload } from "../template-utils/types";

export interface EngineFrontendInputs<Ps extends TemplatePairs> {
  onSubmit(payload: UserQueryResponsePayload[]): void;
  rootNode: HTMLElement;
  registry: TemplateRegistry<Ps>;
}

export interface EngineFrontend<Ps extends TemplatePairs> {
  takeNext(data: TemplateUnion<Ps>): void;
  reset(): void;
  unmount(): void;
}

/** Turns a validated template tree into a React element tree, recursively. */
export function createEngineFrontend<Ps extends TemplatePairs>({
  onSubmit,
  rootNode,
  registry,
}: EngineFrontendInputs<Ps>): EngineFrontend<Ps> {
  let root: Root | null = createRoot(rootNode);
  type Id = keyof TemplateRegistry<Ps>["components"];

  const keyFor = (id: string, path: number[]) =>
    `${id}:${path.length ? path.join(".") : "0"}`;

  const toElement = (
    node: TemplateUnion<Ps>,
    path: number[] = [],
  ): React.ReactElement => {
    const id = node.id as Id;
    const Comp = registry.components[id] as React.ComponentType<any>;
    if (!Comp) {
      return createElement(Fragment, {
        key: keyFor(String(id ?? "unknown"), path),
      });
    }

    const props: any = { ...node };

    // Recursively render children if present
    if (Array.isArray((node as any).children)) {
      props.children = ((node as any).children as Array<TemplateUnion<Ps>>).map(
        (child, i) => toElement(child, [...path, i]),
      );
    }

    if (id === "form" || id === "option") {
      props.onSubmit = onSubmit;
    }

    const element = createElement(Comp, {
      key: keyFor(String(id), path),
      ...props,
    });
    console.log("ELEMENT CREATED", element);
    return element;
  };

  const takeNext = (data: TemplateUnion<Ps>) => {
    if (!root) root = createRoot(rootNode);
    root.render(toElement(data));
  };

  const reset = () => root?.render(createElement(Fragment));

  const unmount = () => {
    root?.unmount();
    root = null;
  };

  return { takeNext, reset, unmount };
}
