import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import PickSchoolScreen from "@/app/(auth)/pick-school";
import { useSignupFlow } from "@/lib/signup-flow";
import { useUniversitySearch } from "@/lib/universities";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("@/lib/universities", () => ({
  useDebouncedValue: jest.fn((v: string) => v),
  useUniversitySearch: jest.fn(),
}));

const mockedSearch = useUniversitySearch as jest.Mock;
const SCHOOL = {
  id: "u1",
  name: "University of Virginia-Main Campus",
  short_name: "UVA",
  state: "VA",
  country: "US",
  email_domains: ["virginia.edu"],
};

const state = (over: object) => ({
  data: undefined,
  isPending: false,
  isError: false,
  refetch: jest.fn(),
  ...over,
});

describe("PickSchoolScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSignupFlow.getState().clear();
    mockedSearch.mockReturnValue(state({}));
  });

  it("shows the empty state before typing", async () => {
    await render(<PickSchoolScreen />);
    expect(screen.getByText(/start typing/i)).toBeTruthy();
    expect(screen.getByText(/can't be changed later/i)).toBeTruthy();
  });

  it("renders results with name, state, and short_name chip", async () => {
    mockedSearch.mockReturnValue(state({ data: [SCHOOL] }));
    await render(<PickSchoolScreen />);
    await fireEvent.changeText(screen.getByTestId("school-search"), "virginia");
    expect(screen.getByText(SCHOOL.name)).toBeTruthy();
    expect(screen.getByText("UVA")).toBeTruthy();
    expect(screen.getByText("VA, US")).toBeTruthy();
  });

  it("omits the chip when short_name is null", async () => {
    mockedSearch.mockReturnValue(
      state({ data: [{ ...SCHOOL, short_name: null }] }),
    );
    await render(<PickSchoolScreen />);
    await fireEvent.changeText(screen.getByTestId("school-search"), "virginia");
    expect(screen.getByText(SCHOOL.name)).toBeTruthy();
    expect(screen.queryByText("UVA")).toBeNull();
  });

  it("shows the no-results state", async () => {
    mockedSearch.mockReturnValue(state({ data: [] }));
    await render(<PickSchoolScreen />);
    await fireEvent.changeText(screen.getByTestId("school-search"), "zzzz");
    expect(screen.getByText(/no schools match/i)).toBeTruthy();
  });

  it("shows error state with retry", async () => {
    const refetch = jest.fn();
    mockedSearch.mockReturnValue(state({ isError: true, refetch }));
    await render(<PickSchoolScreen />);
    await fireEvent.changeText(screen.getByTestId("school-search"), "state");
    await fireEvent.press(screen.getByText(/try again/i));
    expect(refetch).toHaveBeenCalled();
  });

  it("selecting a school stores it and advances to sign-up", async () => {
    mockedSearch.mockReturnValue(state({ data: [SCHOOL] }));
    await render(<PickSchoolScreen />);
    await fireEvent.changeText(screen.getByTestId("school-search"), "virginia");
    await fireEvent.press(screen.getByTestId("school-row-u1"));
    expect(useSignupFlow.getState().school?.id).toBe("u1");
    expect(useSignupFlow.getState().school?.email_domains).toEqual([
      "virginia.edu",
    ]);
    expect(mockPush).toHaveBeenCalledWith("/sign-up");
  });

  it("'My school isn't listed' routes to the stub", async () => {
    await render(<PickSchoolScreen />);
    await fireEvent.press(screen.getByTestId("school-not-listed"));
    expect(mockPush).toHaveBeenCalledWith("/school-unavailable");
  });
});
