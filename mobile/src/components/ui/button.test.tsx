import { fireEvent, render, screen } from "@testing-library/react-native";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("calls onPress when enabled", async () => {
    const onPress = jest.fn();
    await render(<Button onPress={onPress}>Go</Button>);
    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", async () => {
    const onPress = jest.fn();
    await render(
      <Button disabled onPress={onPress}>
        Go
      </Button>,
    );
    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("does not call onPress when loading", async () => {
    const onPress = jest.fn();
    await render(
      <Button loading onPress={onPress}>
        Go
      </Button>,
    );
    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
