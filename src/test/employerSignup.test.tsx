import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import ForEmployers from "@/pages/employer/ForEmployers";

const { signUp, navigate } = vi.hoisted(() => ({ signUp: vi.fn(), navigate: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signUp } } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("react-router-dom", async (original) => ({ ...await original<typeof import("react-router-dom")>(), useNavigate: () => navigate }));
beforeEach(() => vi.clearAllMocks());

it("waits for confirmation instead of treating a sessionless signup as logged in", async () => {
  signUp.mockResolvedValue({ data: { session: null }, error: null });
  render(<MemoryRouter><ForEmployers /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Pracovní e-mail"), { target: { value: "employer@example.test" } });
  fireEvent.change(screen.getByLabelText("Heslo"), { target: { value: "example-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Vytvořit firemní účet" }));
  await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
  expect(signUp.mock.calls[0][0].options).toEqual({ emailRedirectTo: `${window.location.origin}/employer/company`, data: { user_type: "employer" } });
  expect(navigate).not.toHaveBeenCalled();
});