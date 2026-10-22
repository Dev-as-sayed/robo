import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope, Contact } from "@/types";

export interface CreateContactInput {
  name: string;
  phone?: string;
  email?: string;
  group?: string;
}

export const contactsApi = createApi({
  reducerPath: "contactsApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Contacts"],
  endpoints: builder => ({
    contacts: builder.query<Contact[], void>({
      query: () => "/contacts",
      transformResponse: (response: ApiEnvelope<{ contacts: Contact[] }>) =>
        response.data.contacts,
      providesTags: ["Contacts"],
    }),
    createContact: builder.mutation<Contact, CreateContactInput>({
      query: body => ({ url: "/contacts", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<{ contact: Contact }>) =>
        response.data.contact,
      invalidatesTags: ["Contacts"],
    }),
    deleteContact: builder.mutation<void, string>({
      query: id => ({ url: `/contacts/${id}`, method: "DELETE" }),
      invalidatesTags: ["Contacts"],
    }),
  }),
});

export const {
  useContactsQuery,
  useCreateContactMutation,
  useDeleteContactMutation,
} = contactsApi;
