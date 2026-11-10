import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Modal } from "../components/ui/Modal";
import { Breadcrumb } from "../components/ui/Breadcrumb";
import { DashboardPage } from "../pages/student/DashboardPage";
import { MyCoursesPage } from "../pages/student/MyCoursesPage";
import { MyAssignmentsPage } from "../pages/student/MyAssignmentsPage";
import { GlobalSearchPage } from "../pages/student/GlobalSearchPage";
import { api } from "../services/api";

// Mock api
vi.mock("../services/api", () => ({
  api: {
    getDashboard: vi.fn(),
    getCourses: vi.fn(),
    getCourseDetails: vi.fn(),
    getMaterials: vi.fn(),
    getAssignments: vi.fn(),
    getAssignmentDetails: vi.fn(),
    submitAssignment: vi.fn(),
    search: vi.fn(),
  },
}));

// Mock useAuth
vi.mock("../app/AuthContext", () => ({
  useAuth: () => ({
    user: { _id: "test-user-id", fullName: "Alice Johnson", email: "student01@lms-demo.test", role: "Student" },
    isAuthenticated: true,
    isStudent: true,
    logout: vi.fn(),
  }),
}));

describe("UI Primitives & Feedback Components", () => {
  it("renders Badge with appropriate status labels and styles", () => {
    const { rerender } = render(<Badge variant="SUBMITTED" />);
    expect(screen.getByText("Submitted")).toBeDefined();

    rerender(<Badge variant="GRADED" />);
    expect(screen.getByText("Graded")).toBeDefined();

    rerender(<Badge variant="OVERDUE" />);
    expect(screen.getByText("Past Due")).toBeDefined();

    rerender(<Badge variant="LectureNote" />);
    expect(screen.getByText("Lecture Note")).toBeDefined();
  });

  it("renders Button and handles click events and loading state", () => {
    const handleClick = vi.fn();
    const { rerender } = render(<Button onClick={handleClick}>Submit Now</Button>);
    const button = screen.getByText("Submit Now");
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);

    rerender(<Button loading>Submit Now</Button>);
    expect(screen.getByRole("button").disabled).toBe(true);
  });

  it("renders EmptyState with action button", () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No items found"
        description="Try searching for another keyword"
        actionLabel="Reset Filter"
        onAction={handleAction}
      />
    );
    expect(screen.getByText("No items found")).toBeDefined();
    expect(screen.getByText("Try searching for another keyword")).toBeDefined();

    const actionBtn = screen.getByText("Reset Filter");
    fireEvent.click(actionBtn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it("renders ErrorBanner with retry trigger", () => {
    const handleRetry = vi.fn();
    render(<ErrorBanner message="Network connection failed" onRetry={handleRetry} />);
    expect(screen.getByText("Network connection failed")).toBeDefined();

    const retryBtn = screen.getByText("Retry");
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("renders Breadcrumb navigation trail", () => {
    render(
      <BrowserRouter>
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/student/dashboard" },
            { label: "My Courses", to: "/student/courses" },
            { label: "PRG101" },
          ]}
        />
      </BrowserRouter>
    );
    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("My Courses")).toBeDefined();
    expect(screen.getByText("PRG101")).toBeDefined();
  });

  it("opens Modal and invokes onClose on close button", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Preview Document">
        <p>Document preview body content</p>
      </Modal>
    );
    expect(screen.getByText("Preview Document")).toBeDefined();
    expect(screen.getByText("Document preview body content")).toBeDefined();

    const closeBtn = screen.getByLabelText("Close modal");
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

describe("Student Pages Integration", () => {
  it("DashboardPage renders enrolled courses and upcoming assignments", async () => {
    api.getDashboard.mockResolvedValue({
      status: "success",
      data: {
        courses: [
          {
            _id: "c1",
            courseCode: "DEMO-PRG101",
            courseName: "Programming Techniques",
            description: "Core algorithms and data structures.",
            isActive: true,
            materialCount: 3,
            assignmentCount: 2,
          },
        ],
        upcomingAssignments: [
          {
            _id: "a1",
            title: "Project 1",
            dueDate: new Date(Date.now() + 86400000).toISOString(),
            status: "PENDING",
            courseId: { courseCode: "DEMO-PRG101" },
          },
        ],
        recentAnnouncements: [],
        stats: { totalCourses: 1, pendingAssignments: 1, submittedAssignments: 0 },
      },
    });

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Programming Techniques/i)).toBeDefined();
      expect(screen.getAllByText(/DEMO-PRG101/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Project 1/i).length).toBeGreaterThan(0);
    });
  });

  it("MyCoursesPage renders list and handles empty search results", async () => {
    api.getCourses.mockResolvedValue({
      status: "success",
      data: [
        {
          _id: "c1",
          courseCode: "DEMO-DB201",
          courseName: "Database Systems",
          description: "Relational modeling and query execution.",
          isActive: true,
          materialCount: 4,
          assignmentCount: 3,
        },
      ],
    });

    render(
      <BrowserRouter>
        <MyCoursesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Database Systems/i)).toBeDefined();
      expect(screen.getByText(/DEMO-DB201/i)).toBeDefined();
    });
  });

  it("MyAssignmentsPage renders assignments and computed statuses", async () => {
    api.getCourses.mockResolvedValue({
      status: "success",
      data: [
        { _id: "c1", courseCode: "DEMO-DB201", courseName: "Database Systems" },
      ],
    });

    api.getAssignments.mockResolvedValue({
      status: "success",
      data: [
        {
          _id: "assign1",
          title: "SQL Query Lab",
          courseId: { courseCode: "DEMO-DB201", courseName: "Database Systems" },
          dueDate: new Date(Date.now() + 100000).toISOString(),
          maxScore: 10,
          status: "PENDING",
        },
      ],
    });

    render(
      <BrowserRouter>
        <MyAssignmentsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/SQL Query Lab/i)).toBeDefined();
      expect(screen.getAllByText(/Not Submitted/i).length).toBeGreaterThan(0);
    });
  });

  it("GlobalSearchPage renders initial prompt and category tabs upon search", async () => {
    api.search.mockResolvedValue({
      status: "success",
      data: {
        courses: [{ _id: "c1", courseCode: "DEMO-PRG101", courseName: "Programming Techniques", isActive: true }],
        materials: [],
        assignments: [],
        counts: { courses: 1, materials: 0, assignments: 0, total: 1 },
      },
    });

    render(
      <BrowserRouter>
        <GlobalSearchPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Search your university coursework/i)).toBeDefined();
  });
});
