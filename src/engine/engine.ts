import {
  createEngineBackend,
  type EngineBackendInputs,
} from "./engine-backend";

import {
  createEngineFrontend,
  type EngineFrontendInputs,
} from "./engine-frontend";

import type {
  TemplatePairs,
  TemplateRegistry,
} from "../template-utils/template-react-binding";
import React from "react";

type SchemaFromPairs<Ps extends TemplatePairs> = TemplateRegistry<Ps>["schema"];

type Providers = React.ComponentType<{ children: React.ReactNode }>;

export type EngineInputs<Ps extends TemplatePairs> = EngineFrontendInputs<Ps> &
  Pick<
    EngineBackendInputs<SchemaFromPairs<Ps>>,
    "debug" | "logger" | "onInvalid"
  > & {
    wrapper?: Providers;
    streamDone?(): void;
  };

export type CombinedEngine = {
  reset(): void;
  destroy(): void;
  push(delta: string): void;
};

export const createCombinedEngine = async <Ps extends TemplatePairs>(
  inputs: EngineInputs<Ps>,
): Promise<CombinedEngine> => {
  const { registry, rootNode, onSubmit, wrapper, debug, logger, onInvalid } =
    inputs;

  const frontend = createEngineFrontend<Ps>({
    registry,
    rootNode,
    onSubmit,
    debug,
    logger,
    wrapper,
  });

  const backend = await createEngineBackend<SchemaFromPairs<Ps>>({
    schema: registry.schema,
    onNext: (tree) => frontend.takeNext(tree),
    onInvalid,
    debug,
    logger,
  });

  return {
    reset() {
      backend.reset();
      frontend.reset();
    },
    destroy() {
      frontend.unmount();
      backend.reset();
    },
    push(delta: string) {
      backend.next(delta);
    },
  };
};
