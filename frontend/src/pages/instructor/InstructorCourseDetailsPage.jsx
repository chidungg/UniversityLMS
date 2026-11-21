import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import {
  BookOpen,
  Users,
  FolderOpen,
  FileText,
  HelpCircle,
  Plus,
  Edit3,
  Eye,
  Trash2,
  Search,
  ClipboardCheck,
  BarChart2,
  User,
  GraduationCap,
} from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";
import { CourseEditModal } from "./components/CourseEditModal";
import { MaterialFormModal } from "./components/MaterialFormModal";
import { MaterialPreviewModal } from "./components/MaterialPreviewModal";
import { AssignmentFormModal } from "./components/AssignmentFormModal";
import { ConfirmDeleteModal } from "./components/ConfirmDeleteModal";
import { SuccessBanner } from "./components/SuccessBanner";
import { formatDateTime, formatShortDate } from "./components/formatters";

const TABS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "materials", label: "Learning Materials", icon: FolderOpen },
  { id: "assignments", label: "Assignments", icon: FileText },
  { id: "quizzes", label: "Quizzes", icon: HelpCircle },
  { id: "students", label: "Enrolled Students", icon: Users },
];

export const InstructorCourseDetailsPage = () => {
  const { courseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.id === initialTab) ? initialTab : "overview"
  );
  const [data, setData] = useState(null);
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  // Modals
  const [editCourseOpen, setEditCourseOpen] = useState(false);
  const [materialModal, setMaterialModal] = useState({ open: false, material: null });
  const [previewMaterial, setPreviewMaterial] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [assignmentModal, setAssignmentModal] = useState({ open: false, assignment: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, kind: "", item: null });
  const [deleting, setDeleting] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const fetchCourseDetails = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [detailRes, listRes] = await Promise.all([
        api.getInstructorCourseDetails(courseId),
        api.getInstructorCourses(),
      ]);
      if (detailRes.status === "success") {
        setData(detailRes.data);
      }
      if (listRes.status === "success") {
        setAllCourses(listRes.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load course workspace.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourseDetails();
  }, [fetchCourseDetails]);

  const switchTab = (tabId) => {
    setActiveTab(tabId);
    setSearchParams(tabId === "overview" ? {} : { tab: tabId });
  };

  const handleSaveCourse = async (id, payload) => {
    await api.updateInstructorCourse(id, payload);
    setFeedback("Course details updated.");
    await fetchCourseDetails();
  };

  const handleSaveMaterial = async (payload, materialId) => {
    if (materialId) {
      await api.updateMaterial(materialId, payload);
      setFeedback("Learning material updated.");
    } else {
      await api.createMaterial(payload);
      setFeedback("Learning material uploaded.");
    }
    await fetchCourseDetails();
  };

  const handleSaveAssignment = async (payload, assignmentId) => {
    if (assignmentId) {
      await api.updateAssignment(assignmentId, payload);
      setFeedback("Assignment updated.");
    } else {
      await api.createAssignment(payload);
      setFeedback("Assignment created.");
    }
    await fetchCourseDetails();
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.item) return;
    setDeleting(true);
    try {
      if (deleteModal.kind === "material") {
        await api.deleteMaterial(deleteModal.item._id);
        setFeedback(`Deleted material "${deleteModal.item.title}".`);
      } else if (deleteModal.kind === "assignment") {
        await api.deleteAssignment(deleteModal.item._id);
        setFeedback(`Deleted assignment "${deleteModal.item.title}".`);
      } else if (deleteModal.kind === "quiz") {
        await api.deleteQuiz(deleteModal.item._id);
        setFeedback(`Deleted quiz "${deleteModal.item.title}".`);
      }
      setDeleteModal({ open: false, kind: "", item: null });
      await fetchCourseDetails();
    } catch (err) {
      setError(err.message || "Deletion failed.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadMaterial = async (material) => {
    setDownloading(true);
    try {
      const blob = await api.downloadMaterialBlob(material._id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = material.fileName || `${(material.title || "material").replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError("Download failed: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading course workspace..." />;
  }

  if (error || !data?.course) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/instructor/dashboard" },
            { label: "Assigned Courses", to: "/instructor/courses" },
            { label: "Course Workspace" },
          ]}
        />
        <ErrorBanner message={error || "Course not found."} onRetry={fetchCourseDetails} />
      </div>
    );
  }

  const { course, materials = [], assignments = [], quizzes = [], students = [] } = data;
  const theme = getCourseTheme(course);
  const SubjectIcon = theme.icon;

  const filteredStudents = students.filter((s) => {
    if (!studentSearch.trim()) return true;
    const term = studentSearch.trim().toLowerCase();
    return (
      s.fullName.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      (s.studentCode && s.studentCode.toLowerCase().includes(term))
    );
  });

  const tabCounts = {
    materials: materials.length,
    assignments: assignments.length,
    quizzes: quizzes.length,
    students: students.length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Assigned Courses", to: "/instructor/courses" },
          { label: course.courseCode },
        ]}
      />

      <SuccessBanner message={feedback} onDismiss={() => setFeedback("")} />

      {/* Course Hero Card */}
      <div
        className="lms-course-card"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          borderTop: `4px solid ${theme.color}`,
          padding: "22px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: theme.badgeColor,
                  backgroundColor: theme.badgeBg,
                  border: `1px solid ${theme.border}`,
                  padding: "3px 10px",
                  borderRadius: "4px",
                }}
              >
                <SubjectIcon size={14} />
                {course.courseCode}
              </span>
              <Badge variant={course.isActive ? "ACTIVE" : "INACTIVE"} />
            </div>

            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text)", marginBottom: "6px" }}>
              {course.courseName}
            </h1>

            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", fontSize: "13px", color: "var(--color-text-secondary)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <User size={14} style={{ color: "var(--color-text-muted)" }} />
                Instructor: <strong>{course.instructor}</strong>
              </span>
              <span>•</span>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <GraduationCap size={14} style={{ color: "var(--color-text-muted)" }} />
                Semester: Fall 2026
              </span>
            </div>
          </div>

          <Button variant="secondary" size="sm" icon={Edit3} onClick={() => setEditCourseOpen(true)}>
            Edit Course Info
          </Button>
        </div>

        <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: 1.6, maxWidth: "75ch" }}>
          {course.description || "No syllabus description provided for this course."}
        </p>

        {/* Course Tab Navigation */}
        <div
          role="tablist"
          aria-label="Course workspace sections"
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            paddingTop: "14px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const active = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`lms-pill-tab ${active ? "active" : ""}`}
                onClick={() => switchTab(tab.id)}
              >
                <TabIcon size={15} />
                <span>{tab.label}</span>
                {count !== undefined && (
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "1px 6px",
                      borderRadius: "10px",
                      backgroundColor: active ? "#FFFFFF" : "var(--color-surface-soft)",
                      color: active ? "var(--color-primary-700)" : "var(--color-text-muted)",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            className="tabular-nums"
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              padding: "18px 24px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "20px",
            }}
          >
            <div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)" }}>{students.length}</div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Enrolled Students</div>
            </div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-primary-700)" }}>{materials.length}</div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Learning Materials</div>
            </div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)" }}>{assignments.length}</div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Assignments</div>
            </div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-warning)" }}>{course.pendingGradingCount ?? 0}</div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Ungraded Submissions</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            <div style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", padding: "18px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>Learning Materials</h2>
                <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                  Share lecture slides, recorded videos, and lab sheets with your students.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="primary" size="sm" icon={Plus} onClick={() => setMaterialModal({ open: true, material: null })}>
                  Upload Material
                </Button>
                <Button variant="secondary" size="sm" onClick={() => switchTab("materials")}>
                  View All
                </Button>
              </div>
            </div>

            <div style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", padding: "18px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>Assignments & Grading</h2>
                <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                  Post coursework deadlines, inspect submitted files, and record student grades.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="primary" size="sm" icon={Plus} onClick={() => setAssignmentModal({ open: true, assignment: null })}>
                  Create Assignment
                </Button>
                <Button variant="secondary" size="sm" onClick={() => switchTab("assignments")}>
                  View All
                </Button>
              </div>
            </div>

            <div style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", padding: "18px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>Quizzes & Assessments</h2>
                <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                  Build multiple-choice quizzes, configure time limits, and inspect scores.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <Link to={`/instructor/quizzes/new?courseId=${course._id}`}>
                  <Button variant="primary" size="sm" icon={Plus}>
                    Create Quiz
                  </Button>
                </Link>
                <Button variant="secondary" size="sm" onClick={() => switchTab("quizzes")}>
                  View All
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LEARNING MATERIALS */}
      {activeTab === "materials" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <h2 style={{ fontSize: "17px", fontWeight: 600 }}>Course Learning Materials</h2>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setMaterialModal({ open: true, material: null })}>
              Upload Material
            </Button>
          </div>

          {materials.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No materials in this course"
              description="Upload lecture notes, video links, or lab worksheets for enrolled students."
              actionLabel="Upload Material"
              onAction={() => setMaterialModal({ open: true, material: null })}
            />
          ) : (
            <div style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--color-surface-soft)", borderBottom: "1px solid var(--color-border)", fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 18px" }}>Title</th>
                    <th style={{ padding: "12px 16px" }}>Category</th>
                    <th style={{ padding: "12px 16px" }}>Uploaded</th>
                    <th style={{ padding: "12px 18px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m, idx) => (
                    <tr key={m._id} className="lms-table-row" style={{ borderBottom: idx === materials.length - 1 ? "none" : "1px solid var(--color-border-subtle)" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>{m.title}</div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{m.description || "No description"}</div>
                      </td>
                      <td style={{ padding: "14px 16px" }}><Badge variant={m.type} size="sm" /></td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px", color: "var(--color-text-muted)" }}>{formatShortDate(m.uploadedAt)}</td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                          <Button variant="secondary" size="sm" icon={Eye} onClick={() => setPreviewMaterial(m)}>Preview</Button>
                          <Button variant="outline" size="sm" icon={Edit3} onClick={() => setMaterialModal({ open: true, material: m })}>Edit</Button>
                          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleteModal({ open: true, kind: "material", item: m })} style={{ color: "var(--color-danger)" }}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ASSIGNMENTS */}
      {activeTab === "assignments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <h2 style={{ fontSize: "17px", fontWeight: 600 }}>Course Assignments</h2>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setAssignmentModal({ open: true, assignment: null })}>
              Create Assignment
            </Button>
          </div>

          {assignments.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No assignments posted yet"
              description="Create coursework assignments with deadlines and point scales for this course."
              actionLabel="Create Assignment"
              onAction={() => setAssignmentModal({ open: true, assignment: null })}
            />
          ) : (
            <div style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--color-surface-soft)", borderBottom: "1px solid var(--color-border)", fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 18px" }}>Assignment</th>
                    <th style={{ padding: "12px 16px" }}>Due Date</th>
                    <th style={{ padding: "12px 16px" }}>Max Score</th>
                    <th style={{ padding: "12px 16px" }}>Submissions</th>
                    <th style={{ padding: "12px 18px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a, idx) => (
                    <tr key={a._id} className="lms-table-row" style={{ borderBottom: idx === assignments.length - 1 ? "none" : "1px solid var(--color-border-subtle)" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <Link to={`/instructor/assignments/${a._id}`} style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>
                          {a.title}
                        </Link>
                      </td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>{formatDateTime(a.dueDate)}</td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>{a.maxScore ?? 10} pts</td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>
                        <span>{a.submissionCount ?? 0} / {a.enrolledCount ?? 0} submitted</span>
                        {a.ungradedCount > 0 && (
                          <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 600, color: "var(--color-warning)" }}>
                            ({a.ungradedCount} ungraded)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                          <Link to={`/instructor/assignments/${a._id}`}>
                            <Button variant="primary" size="sm" icon={ClipboardCheck}>Submissions</Button>
                          </Link>
                          <Button variant="outline" size="sm" icon={Edit3} onClick={() => setAssignmentModal({ open: true, assignment: a })}>Edit</Button>
                          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleteModal({ open: true, kind: "assignment", item: a })} style={{ color: "var(--color-danger)" }}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: QUIZZES */}
      {activeTab === "quizzes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <h2 style={{ fontSize: "17px", fontWeight: 600 }}>Course Quizzes & Assessments</h2>
            <Link to={`/instructor/quizzes/new?courseId=${course._id}`}>
              <Button variant="primary" size="sm" icon={Plus}>Create Quiz</Button>
            </Link>
          </div>

          {quizzes.length === 0 ? (
            <EmptyState
              icon={HelpCircle}
              title="No quizzes scheduled in this course"
              description="Create a multiple-choice quiz with automated grading and question explanations."
            />
          ) : (
            <div style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--color-surface-soft)", borderBottom: "1px solid var(--color-border)", fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 18px" }}>Quiz Title</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px" }}>Time Limit</th>
                    <th style={{ padding: "12px 16px" }}>Questions</th>
                    <th style={{ padding: "12px 16px" }}>Attempts</th>
                    <th style={{ padding: "12px 18px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.map((q, idx) => (
                    <tr key={q._id} className="lms-table-row" style={{ borderBottom: idx === quizzes.length - 1 ? "none" : "1px solid var(--color-border-subtle)" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>{q.title}</div>
                        <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                          {formatShortDate(q.startTime)} – {formatShortDate(q.endTime)}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}><Badge variant={q.computedStatus} size="sm" /></td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>{q.timeLimit} mins</td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>{q.questionCount} ({q.maxScore} pts)</td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>
                        {q.attemptCount} {q.avgScore !== null ? `(Avg: ${q.avgScore})` : ""}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                          <Link to={`/instructor/quizzes/${q._id}/results`}>
                            <Button variant="secondary" size="sm" icon={BarChart2}>Results</Button>
                          </Link>
                          <Link to={`/instructor/quizzes/${q._id}/edit`}>
                            <Button variant="outline" size="sm" icon={Edit3}>Edit</Button>
                          </Link>
                          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleteModal({ open: true, kind: "quiz", item: q })} style={{ color: "var(--color-danger)" }}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ENROLLED STUDENTS (I02) */}
      {activeTab === "students" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "17px", fontWeight: 600 }}>Enrolled Student Roster</h2>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                {students.length} students enrolled in {course.courseCode}.
              </p>
            </div>
            <div style={{ width: "260px" }}>
              <Input
                icon={Search}
                placeholder="Search student name, ID, email..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                style={{ height: "36px" }}
              />
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <EmptyState
              icon={Users}
              title={studentSearch ? "No matching students" : "No students enrolled yet"}
              description={
                studentSearch
                  ? "No enrolled students matched your search term."
                  : "No students have been enrolled into this course by administration yet."
              }
              actionLabel={studentSearch ? "Clear Search" : undefined}
              onAction={studentSearch ? () => setStudentSearch("") : undefined}
            />
          ) : (
            <div style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--color-surface-soft)", borderBottom: "1px solid var(--color-border)", fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 18px" }}>Student</th>
                    <th style={{ padding: "12px 16px" }}>Student ID</th>
                    <th style={{ padding: "12px 16px" }}>Enrolled Date</th>
                    <th style={{ padding: "12px 16px" }}>Assignments</th>
                    <th style={{ padding: "12px 16px" }}>Quizzes</th>
                    <th style={{ padding: "12px 16px" }}>Avg Score</th>
                    <th style={{ padding: "12px 18px", textAlign: "right" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, idx) => (
                    <tr key={s._id} className="lms-table-row" style={{ borderBottom: idx === filteredStudents.length - 1 ? "none" : "1px solid var(--color-border-subtle)" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>{s.fullName}</div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{s.email}</div>
                      </td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px", color: "var(--color-text-secondary)" }}>
                        {s.studentCode || "—"}
                      </td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px", color: "var(--color-text-muted)" }}>
                        {formatShortDate(s.enrolledAt)}
                      </td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>
                        {s.assignmentsSubmitted} / {s.totalAssignments}
                      </td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>
                        {s.quizzesCompleted} / {s.totalQuizzes}
                      </td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600 }}>
                        {s.averageScore !== null ? `${s.averageScore} / 10` : "—"}
                      </td>
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <Button variant="outline" size="sm" onClick={() => setSelectedStudent(s)}>
                          View Summary
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CourseEditModal
        isOpen={editCourseOpen}
        onClose={() => setEditCourseOpen(false)}
        course={course}
        onSave={handleSaveCourse}
      />

      <MaterialFormModal
        isOpen={materialModal.open}
        onClose={() => setMaterialModal({ open: false, material: null })}
        material={materialModal.material}
        courses={allCourses}
        defaultCourseId={course._id}
        onSave={handleSaveMaterial}
      />

      <MaterialPreviewModal
        material={previewMaterial}
        onClose={() => setPreviewMaterial(null)}
        onDownload={handleDownloadMaterial}
        downloading={downloading}
      />

      <AssignmentFormModal
        isOpen={assignmentModal.open}
        onClose={() => setAssignmentModal({ open: false, assignment: null })}
        assignment={assignmentModal.assignment}
        courses={allCourses}
        defaultCourseId={course._id}
        onSave={handleSaveAssignment}
      />

      <ConfirmDeleteModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, kind: "", item: null })}
        onConfirm={handleConfirmDelete}
        title={`Delete ${deleteModal.kind ? deleteModal.kind.charAt(0).toUpperCase() + deleteModal.kind.slice(1) : "Item"}`}
        itemName={deleteModal.item?.title}
        warningText="This permanently removes the record from this course."
        loading={deleting}
      />

      {/* Student Progress Modal */}
      <Modal
        isOpen={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        title={selectedStudent ? `Student Summary — ${selectedStudent.fullName}` : "Student Summary"}
        maxWidth="600px"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setSelectedStudent(null)}>
            Close
          </Button>
        }
      >
        {selectedStudent && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", backgroundColor: "var(--color-surface-soft)", border: "1px solid var(--color-border)" }}>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>{selectedStudent.fullName}</div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                {selectedStudent.studentCode} · {selectedStudent.email} · Enrolled {formatShortDate(selectedStudent.enrolledAt)}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Assignment Submissions</h3>
              {selectedStudent.submissions?.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>No assignment submissions recorded in this course.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedStudent.submissions.map((sub) => (
                    <div key={sub._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>{sub.assignmentTitle}</div>
                        <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Submitted {formatShortDate(sub.submittedAt)}</div>
                      </div>
                      <span className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, color: sub.grade !== null ? "var(--color-success)" : "var(--color-warning)" }}>
                        {sub.grade !== null && sub.grade !== undefined ? `${sub.grade} / ${sub.maxScore}` : "Awaiting grading"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Quiz Attempts</h3>
              {selectedStudent.quizAttempts?.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>No quiz attempts completed in this course.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedStudent.quizAttempts.map((att) => (
                    <div key={att._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>{att.quizTitle}</div>
                        <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Submitted {formatShortDate(att.submittedAt)}</div>
                      </div>
                      <span className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-primary-700)" }}>
                        {att.score} / {att.maxScore} ({att.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
