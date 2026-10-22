import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope, Device, PairingCode } from "@/types";

interface UpdateDeviceInput {
  id: string;
  name?: string;
  locale?: string;
}

export const devicesApi = createApi({
  reducerPath: "devicesApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Devices"],
  endpoints: builder => ({
    devices: builder.query<Device[], void>({
      query: () => "/devices",
      transformResponse: (response: ApiEnvelope<{ devices: Device[] }>) =>
        response.data.devices,
      providesTags: ["Devices"],
    }),
    pairingCode: builder.mutation<PairingCode, void>({
      query: () => ({ url: "/devices/pairing-code", method: "POST" }),
      transformResponse: (response: ApiEnvelope<PairingCode>) => response.data,
    }),
    updateDevice: builder.mutation<Device, UpdateDeviceInput>({
      query: ({ id, ...body }) => ({
        url: `/devices/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response: ApiEnvelope<{ device: Device }>) =>
        response.data.device,
      invalidatesTags: ["Devices"],
    }),
    revokeDevice: builder.mutation<Device, string>({
      query: id => ({ url: `/devices/${id}/revoke`, method: "POST" }),
      transformResponse: (response: ApiEnvelope<{ device: Device }>) =>
        response.data.device,
      invalidatesTags: ["Devices"],
    }),
    factoryResetDevice: builder.mutation<Device, string>({
      query: id => ({ url: `/devices/${id}/factory-reset`, method: "POST" }),
      transformResponse: (response: ApiEnvelope<{ device: Device }>) =>
        response.data.device,
      invalidatesTags: ["Devices"],
    }),
  }),
});

export const {
  useDevicesQuery,
  usePairingCodeMutation,
  useUpdateDeviceMutation,
  useRevokeDeviceMutation,
  useFactoryResetDeviceMutation,
} = devicesApi;
