import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

describe("AlertDialog", () => {
  it("fires action callbacks without closing itself (controlled only)", async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(
      <AlertDialog open onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogTitle>Title</AlertDialogTitle>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={onCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onPress={onConfirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );

    await fireEvent.press(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Title")).toBeTruthy();

    await fireEvent.press(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    // Still rendered — the dialog never closes itself on action/cancel press.
    expect(screen.getByText("Title")).toBeTruthy();
  });

  it("closes when the caller flips open (e.g. from a cancel handler)", async () => {
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogCancel onPress={() => setOpen(false)}>
                Cancel
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }
    await render(<Host />);
    await fireEvent.press(screen.getByText("Cancel"));
    expect(screen.queryByText("Title")).toBeNull();
  });
});
