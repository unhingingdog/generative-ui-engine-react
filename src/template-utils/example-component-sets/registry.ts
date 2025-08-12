import { createTemplateRegistry } from "../template-react-binding";
import { ContainerSet } from "./Container";
import { ParagraphSet } from "./Paragraph";
import { HeadingSet } from "./Heading.tsx";
import { InputSet } from "./Input";
import { OptionSet } from "./Option";
import { FormSet } from "./Form";

export const registry = createTemplateRegistry(
  ContainerSet,
  ParagraphSet,
  InputSet,
  OptionSet,
  FormSet,
  HeadingSet,
);
