import React, { createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import type {
  TemplatePairs,
  TemplateRegistry,
  TemplateUnion,
} from "../template-utils/template-react-binding";
import type { UserQueryResponsePayload } from "../template-utils/types";

type Logger = Pick<Console, "debug" | "warn" | "error">;

type Providers = React.ComponentType<{ children: React.ReactNode }>;

export interface EngineFrontendInputs<Ps extends TemplatePairs> {
  onSubmit(payload: UserQueryResponsePayload[]): void;
  rootNode: HTMLElement;
  registry: TemplateRegistry<Ps>;
  debug?: boolean;
  logger?: Logger;
  wrapper?: Providers;
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
  debug = false,
  logger = console,
  wrapper,
}: EngineFrontendInputs<Ps>): EngineFrontend<Ps> {
  let root: Root | null = createRoot(rootNode);
  let seq = 0;
  type Id = keyof TemplateRegistry<Ps>["components"];

  const logd = (...args: any[]) => debug && logger.debug("[frontend]", ...args);
  const logw = (...args: any[]) => debug && logger.warn("[frontend]", ...args);

  logd("frontend created");

  const keyFor = (id: string, path: number[]) =>
    `${id}:${path.length ? path.join(".") : "0"}`;

  const toElement = (
    node: TemplateUnion<Ps>,
    path: number[] = [],
  ): React.ReactElement => {
    const id = node.id as Id;
    const Comp = registry.components[id] as React.ComponentType<any>;
    if (!Comp) {
      logw(`Component with id="${String(id)}" not found in registry.`);
      return createElement(Fragment, {
        key: keyFor(String(id ?? "unknown"), path),
      });
    }

    const props: any = { ...node };

    if (Array.isArray((node as any).children)) {
      props.children = ((node as any).children as Array<TemplateUnion<Ps>>).map(
        (child, i) => toElement(child, [...path, i]),
      );
    }

    if (id === "form" || id === "option") {
      props.onSubmit = onSubmit;
    }

    return createElement(Comp, {
      key: keyFor(String(id), path),
      ...props,
    });
  };

  const takeNext = (data: TemplateUnion<Ps>) => {
    seq += 1;
    if (!root) {
      logd(`takeNext() is re-creating the React root.`);
      root = createRoot(rootNode);
    }

    // --- Light Logging ---
    // Log that a render is happening with the root component's ID.
    logd(`render#${seq}: updating UI with root component '${data.id}'`);

    const tree = toElement(data);
    root.render(wrapper ? createElement(wrapper, null, tree) : tree);
  };

  const reset = () => {
    logd(`reset() called; clearing React root (was render#${seq})`);
    root?.render(createElement(Fragment));
    seq = 0;
  };

  const unmount = () => {
    logd(`unmount() called; destroying React root.`);
    root?.unmount();
    root = null;
  };

  return { takeNext, reset, unmount };
}
