import "@testing-library/jest-dom";
import { registry } from "../template-utils/example-component-sets/registry";
import { fireEvent, within } from "@testing-library/dom";
import { act } from "react-dom/test-utils";
import { createEngineFrontend } from "./engine-frontend";

import { describe, beforeEach, afterEach, vi, test, expect } from "vitest";

describe("engine-frontend", () => {
  let rootNode: HTMLElement;
  let cleanup: () => void;

  beforeEach(() => {
    rootNode = document.createElement("div");
    document.body.appendChild(rootNode);
    cleanup = () => {
      document.body.removeChild(rootNode);
    };
  });

  afterEach(() => {
    cleanup();
  });

  const mkFrontend = (onSubmit = vi.fn()) => {
    const frontend = createEngineFrontend({
      registry,
      rootNode,
      onSubmit,
    });
    return { frontend, onSubmit };
  };

  test("renders a simple container with heading and paragraph", () => {
    const { frontend } = mkFrontend();

    const tree = {
      id: "container",
      children: [
        { id: "heading", content: "Hello", level: 2 },
        { id: "paragraph", content: "World" },
      ],
    } as any;

    act(() => frontend.takeNext(tree));

    const q = within(rootNode);
    // Heading level 2 with text "Hello"
    expect(
      q.getByRole("heading", { level: 2, name: /hello/i }),
    ).toBeInTheDocument();
    // Paragraph text
    expect(q.getByText("World")).toBeInTheDocument();
  });

  test("supports streamed updates (second takeNext replaces element tree)", () => {
    const { frontend } = mkFrontend();

    const first = {
      id: "container",
      children: [{ id: "heading", content: "Step 1", level: 3 }],
    } as any;

    const second = {
      id: "container",
      children: [
        { id: "heading", content: "Step 2", level: 1 },
        { id: "paragraph", content: "Now with more text" },
      ],
    } as any;

    act(() => frontend.takeNext(first));
    let q = within(rootNode);
    expect(
      q.getByRole("heading", { level: 3, name: /step 1/i }),
    ).toBeInTheDocument();

    act(() => frontend.takeNext(second));
    q = within(rootNode);
    expect(
      q.getByRole("heading", { level: 1, name: /step 2/i }),
    ).toBeInTheDocument();
    expect(q.getByText("Now with more text")).toBeInTheDocument();
  });

  test("reset clears the mounted UI", () => {
    const { frontend } = mkFrontend();

    const tree = {
      id: "paragraph",
      content: "Ephemeral",
    } as any;

    act(() => frontend.takeNext(tree));
    let q = within(rootNode);
    expect(q.getByText("Ephemeral")).toBeInTheDocument();

    act(() => frontend.reset());
    q = within(rootNode);
    expect(q.queryByText("Ephemeral")).toBeNull();
  });

  test("form bridge is present (does not submit automatically)", () => {
    const onSubmit = vi.fn();
    const { frontend } = mkFrontend(onSubmit);

    const formTree = {
      id: "form",
      // Minimal input child; component will own actual submit UI
      children: [{ id: "input", queryId: "name", queryContent: "Name" }],
    } as any;

    act(() => frontend.takeNext(formTree));

    // We don't know the exact button/labels; just assert that rendering didn't invoke submit.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("unmount disposes the React root", () => {
    const { frontend } = mkFrontend();

    const tree = { id: "paragraph", content: "Bye" } as any;

    act(() => frontend.takeNext(tree));
    let q = within(rootNode);
    expect(q.getByText("Bye")).toBeInTheDocument();

    act(() => frontend.unmount());
    q = within(rootNode);
    // After unmount, the container should be empty
    expect(rootNode.childElementCount).toBe(0);
    expect(q.queryByText("Bye")).toBeNull();
  });

  test("fills form inputs and submits payload to onSubmit", () => {
    const onSubmit = vi.fn();
    const { frontend } = mkFrontend(onSubmit);

    const tree = {
      id: "container",
      children: [
        { id: "heading", content: "Title", level: 2 },
        { id: "paragraph", content: "Hi there" },
        {
          id: "form",
          children: [
            { id: "input", queryId: "name", queryContent: "Your name" },
            { id: "input", queryId: "email", queryContent: "Email" },
          ],
        },
      ],
    } as any;

    act(() => frontend.takeNext(tree));

    const q = within(rootNode);

    // Fill inputs (Input uses id=name/email and no associated label)
    const nameInput = rootNode.querySelector<HTMLInputElement>("#name")!;
    const emailInput = rootNode.querySelector<HTMLInputElement>("#email")!;
    expect(nameInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();

    // Fire input events so FormData picks up values
    fireEvent.input(nameInput, { target: { value: "Hamish" } });
    fireEvent.input(emailInput, { target: { value: "h@example.com" } });

    // Submit
    const submitBtn = q.getByRole("button", { name: /continue/i });
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith([
      { queryId: "name", response: "Hamish" },
      { queryId: "email", response: "h@example.com" },
    ]);
  });
});
