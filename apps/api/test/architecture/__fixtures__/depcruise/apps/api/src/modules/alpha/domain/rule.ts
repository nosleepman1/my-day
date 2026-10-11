import { Injectable } from '@nestjs/common';

import { config } from '../../../platform/config/config';

export const rule = [Injectable, config];
