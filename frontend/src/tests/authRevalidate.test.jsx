import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../app/AuthContext";
import { ProtectedRoute } from "../features/auth/SessionControls";
import { AssignmentDetailsPage } from "../pages/student/AssignmentDetailsPage";
import { authApi } from "../services/http";
import { api } from "../services/api";

vi.mock("../services/http", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      me: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
    },
  };
});

vi.mock("../services/api", () => ({
  api: {
    getAssignmentDetails: vi.fn(),
    submitAssignment: vi.fn(),
  },
}));

describe("AuthContext background revalidation preserves assignment file upload state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.me.mockResolvedValue({
      user: {
        _id: "student_1",
        email: "student01@lms-demo.test",
        fullName: "Alice Johnson",
        role: "Student",
        isActive: true,
        mustChangePassword: false,
      },
    });
    api.getAssignmentDetails.mockResolvedValue({
      status: "success",
      data: {
        _id: "assign_1",
        title: "Lab 1 File Upload",
        description: "Attach your solution archive.",
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        maxScore: 10,
        status: "PENDING",
        submission: null,
        courseId: { _id: "c_1", courseCode: "CS101", courseName: "Programming" },
      },
    });
  });

  it("keeps selected file and draft text intact on window focus and visibilitychange", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/student/assignments/assign_1"]}>
        <AuthProvider>
          <Routes>
            <Route element={<ProtectedRoute roles={["Student"]} />}>
              <Route path="/student/assignments/:assignmentId" element={<AssignmentDetailsPage />} />
            </Route>
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    const heading = await screen.findByRole("heading", { name: "Lab 1 File Upload" });
    expect(heading).toBeDefined();

    const textarea = screen.getByPlaceholderText(/Type your explanation/i);
    fireEvent.change(textarea, { target: { value: "My assignment notes" } });

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(["print('hello')"], "solution.py", { type: "text/x-python" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(fileInput.files[0].name).toBe("solution.py");

    // Simulate OS file dialog closing (window focus) and tab switching (visibilitychange)
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Page must NOT unmount into SessionStatus and must keep file + text intact
    expect(screen.queryByText(/Đang kiểm tra phiên đăng nhập/i)).toBeNull();
    expect(screen.getByPlaceholderText(/Type your explanation/i).value).toBe("My assignment notes");
    expect(container.querySelector('input[type="file"]').files[0].name).toBe("solution.py");
  });

  it("still redirects to /login when background revalidation reports an expired session", async () => {
    render(
      <MemoryRouter initialEntries={["/student/assignments/assign_1"]}>
        <AuthProvider>
          <Routes>
            <Route element={<ProtectedRoute roles={["Student"]} />}>
              <Route path="/student/assignments/:assignmentId" element={<AssignmentDetailsPage />} />
            </Route>
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Lab 1 File Upload" });

    authApi.me.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeDefined();
    });
  });
});
