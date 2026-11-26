import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PASSWORD = "CommBrowser2026!";

async function signIn(page, email) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function signOut(page) {
  await page.getByRole("button", { name: /Log out|Đăng xuất/i }).click();
  await expect(page).toHaveURL(/\/login/);
}

test("live E2E: bidirectional Instructor <-> Student Announcements and Messaging with authorization, persistence, and responsive checks", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const runTag = Date.now();
  const annTitle = `E2E Midterm Exam Notice ${runTag}`;
  const annContent = `Please arrive 15 minutes early in Room A101 (${runTag}).`;
  const studentMsg = `Hello Dr. Turing, is a calculator permitted? (${runTag})`;
  const instructorReply = `Yes, a basic scientific calculator is allowed. (${runTag})`;

  // 1. Instructor A logs in and publishes an announcement for Course A (COMM-101)
  await signIn(page, "inst.a@comm-e2e.test");
  await expect(page).toHaveURL(/\/instructor\//);

  await page.getByRole("navigation", { name: "Teaching modules", exact: true })
    .getByRole("link", { name: "Announcements", exact: true })
    .click();
  await expect(page).toHaveURL(/\/instructor\/announcements$/);

  await page.getByRole("button", { name: "Create Announcement" }).click();
  await expect(page).toHaveURL(/\/instructor\/announcements\/new/);

  // Validate empty submission error feedback
  await page.getByRole("button", { name: /Publish Announcement/i }).click();
  await expect(page.getByText("Announcement title is required.")).toBeVisible();
  await expect(page.getByText("Announcement content cannot be empty.")).toBeVisible();

  await page.getByLabel("Target Course").selectOption({ label: "COMM-101 — Distributed Systems" });
  await page.getByLabel("Announcement Title").fill(annTitle);
  await page.getByLabel("Announcement Content").fill(annContent);
  await page.getByRole("button", { name: /Publish Announcement/i }).click();

  await expect(page.getByText(/published successfully/i)).toBeVisible();
  await page.getByRole("button", { name: "View Published Announcement" }).click();
  await expect(page).toHaveURL(/\/instructor\/announcements\/[a-f0-9]+$/);
  await expect(page.getByRole("heading", { name: annTitle })).toBeVisible();

  const announcementUrl = page.url();
  const announcementId = announcementUrl.split("/").pop();

  await page.evaluate(() => document.fonts.ready);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // 2. Enrolled student logs in, sees announcement unread, opens it, refreshes to verify read persistence
  await signOut(page);
  await signIn(page, "student.a@comm-e2e.test");
  await expect(page).toHaveURL(/\/student\//);

  await page.getByRole("link", { name: "Announcements", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/announcements$/);
  await expect(page.getByText(annTitle)).toBeVisible();

  await page.getByRole("button", { name: annTitle }).click();
  await expect(page.getByRole("dialog").getByText(annContent)).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.reload();
  await expect(page.getByText("Unread (0)")).toBeVisible();

  // 3. Enrolled student sends a new message to Instructor A (Student -> Instructor)
  await page.getByRole("link", { name: "Messages", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/messages/);

  await page.getByRole("button", { name: "New Message" }).first().click();
  await expect(page.getByLabel("Select Instructor:")).toBeVisible();
  await page.getByLabel("Message Content").fill(studentMsg);
  await page.getByRole("button", { name: "Send Message" }).click();

  await expect(page.getByRole("region", { name: "Message conversation" }).getByText(studentMsg)).toBeVisible();
  const sentBubble = page.getByRole("region", { name: "Message conversation" }).getByText(studentMsg).locator("xpath=ancestor::*[@data-sender][1]");
  await expect(sentBubble).toHaveAttribute("data-sender", "self");

  // 4. Non-enrolled student logs in and verifies announcement is inaccessible
  await signOut(page);
  await signIn(page, "student.b@comm-e2e.test");
  await expect(page).toHaveURL(/\/student\//);

  await page.goto("/student/announcements");
  await expect(page.getByText(annTitle)).toHaveCount(0);

  await page.goto(`/student/announcements/${announcementId}`);
  await expect(page.getByRole("alert")).toContainText(/permission/i);

  // 5. Instructor A logs back in, checks unread badge, opens conversation, and replies (Instructor -> Student)
  await signOut(page);
  await signIn(page, "inst.a@comm-e2e.test");
  await expect(page).toHaveURL(/\/instructor\//);
  await page.getByRole("navigation", { name: "Teaching modules", exact: true })
    .getByRole("link", { name: "Messages", exact: true })
    .click();
  await expect(page).toHaveURL(/\/instructor\/messages/);

  const inbox = page.getByRole("complementary", { name: "Conversations inbox" });
  await expect(inbox.getByText("Alice Enrolled")).toBeVisible();
  await expect(inbox.getByLabel(/unread messages/i)).toBeVisible();
  await inbox.getByText("Alice Enrolled").click();
  await expect(inbox.getByLabel(/unread messages/i)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Message conversation" }).getByText(studentMsg)).toBeVisible();

  const replyBox = page.getByLabel("Message Alice Enrolled");
  await replyBox.fill(instructorReply);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("region", { name: "Message conversation" }).getByText(instructorReply)).toBeVisible();

  // Check mobile viewport (375px) on Instructor Messages + back button
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("button", { name: "Back to messages inbox" })).toBeVisible();
  await page.getByRole("button", { name: "Back to messages inbox" }).click();
  await expect(page).toHaveURL(/\/instructor\/messages$/);
  await expect(inbox).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });

  // 6. Enrolled student logs back in, sees unread reply badge, opens thread, and verifies reply + mobile back button
  await signOut(page);
  await signIn(page, "student.a@comm-e2e.test");
  await expect(page).toHaveURL(/\/student\//);
  await page.goto("/student/messages");
  const studentInbox = page.getByRole("complementary", { name: "Conversations inbox" });
  await expect(studentInbox.getByLabel(/unread messages/i)).toBeVisible();
  await studentInbox.getByText("Dr. Alan Turing").click();
  await expect(studentInbox.getByLabel(/unread messages/i)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Message conversation" }).getByText(instructorReply)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Back to messages inbox" }).click();
  await expect(page).toHaveURL(/\/student\/messages$/);
  await expect(studentInbox).toBeVisible();
});
