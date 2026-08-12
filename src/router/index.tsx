import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { CreateTeamView } from "@/views/admin/CreateTeamView";
import { HowItWorksView } from "@/views/admin/HowItWorksView";
import { OverviewView } from "@/views/admin/OverviewView";
import { PayView } from "@/views/admin/PayView";
import { PaymentHistoryView } from "@/views/admin/PaymentHistoryView";
import { RecipientsView } from "@/views/admin/RecipientsView";
import { InviteView } from "@/views/auth/InviteView";
import { LoginView } from "@/views/auth/LoginView";
import { RegisterView } from "@/views/auth/RegisterView";
import { MyPayView } from "@/views/employee/MyPayView";
import {
  HomeRedirect,
  RedirectIfAuthed,
  RequireAdmin,
  RequireAuth,
  RequireEmployee,
} from "./guards";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeRedirect />,
  },
  {
    path: "/login",
    element: (
      <RedirectIfAuthed>
        <LoginView />
      </RedirectIfAuthed>
    ),
  },
  {
    path: "/register",
    element: (
      <RedirectIfAuthed>
        <RegisterView />
      </RedirectIfAuthed>
    ),
  },
  {
    // Invite page must stay mountable after auto-accept sets the session cookie.
    path: "/invite/:token?",
    element: <InviteView />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            element: <RequireAdmin />,
            children: [
              { path: "/pay", element: <PayView /> },
              { path: "/recipients", element: <RecipientsView /> },
              { path: "/overview", element: <OverviewView /> },
              { path: "/teams/create", element: <CreateTeamView /> },
              { path: "/payments", element: <PaymentHistoryView /> },
              { path: "/howitworks", element: <HowItWorksView /> },
            ],
          },
          {
            element: <RequireEmployee />,
            children: [
              { path: "/my-pay", element: <MyPayView /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
