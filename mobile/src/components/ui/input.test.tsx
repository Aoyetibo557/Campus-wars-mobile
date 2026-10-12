import { createRef } from "react";
import { TextInput } from "react-native";
import { render, screen } from "@testing-library/react-native";

import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("forwards ref to the underlying TextInput", async () => {
    const ref = createRef<TextInput>();
    await render(<Input ref={ref} testID="field" />);
    expect(ref.current).toBeTruthy();
    expect(typeof ref.current?.focus).toBe("function");
  });

  it("marks the field invalid when error is set", async () => {
    await render(<Input error testID="field" />);
    const field = screen.getByTestId("field");
    expect(field.props["aria-invalid"]).toBe(true);
    expect(field.props.className).toContain("border-danger");
  });
});
