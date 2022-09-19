/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EuiButton,
  EuiComboBox,
  EuiFieldNumber,
  EuiFieldText,
  EuiFlexItem,
  EuiFormRow,
  EuiPanel,
  EuiSpacer,
  EuiTitle,
  htmlIdGenerator,
} from '@elastic/eui';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { batch, useDispatch } from 'react-redux';
import {
  AGGREGATIONS,
  AGGREGATION_OPTIONS,
  GROUPBY,
  NUMERICAL_TYPES,
  RAW_QUERY,
  SERIES,
  TIMESTAMP,
  TIME_INTERVAL_OPTIONS,
} from '../../../../../../../../common/constants/explorer';
import { ButtonGroupItem } from './config_button_group';
import { VIS_CHART_TYPES } from '../../../../../../../../common/constants/shared';
import { ConfigList, DataConfigPanelProps } from '../../../../../../../../common/types/explorer';
import { TabContext } from '../../../../../hooks';
import { composeAggregations } from '../../../../../../../../common/query_manager/utils';
import {
  ConfigList,
  SelectedConfigItem,
  DataConfigPanelProps,
} from '../../../../../../../../common/types/explorer';
import { TabContext } from '../../../../../hooks';
import { changeQuery } from '../../../../../redux/slices/query_slice';
import { change as changeVizConfig } from '../../../../../redux/slices/viualization_config_slice';
import { DataConfigItemClickPanel } from '../config_controls/data_config_item_click_panel';
import { DataConfigPanelFields } from '../config_controls/data_config_panel_fields';
import { ButtonGroupItem } from './config_button_group';

const initialDimensionEntry = {
  label: '',
  name: '',
};

const initialSeriesEntry = {
  alias: '',
  label: '',
  name: '',
  aggregation: 'count',
};

export const DataConfigPanelItem = ({
  fieldOptionList,
  visualizations,
  qm,
}: DataConfigPanelProps) => {
  const dispatch = useDispatch();
  const {
    tabId,
    handleQuerySearch,
    handleQueryChange,
    setTempQuery,
    fetchData,
    changeVisualizationConfig,
    curVisId,
  } = useContext<any>(TabContext);
  const { data } = visualizations;
  const { data: vizData = {}, metadata: { fields = [] } = {} } = data?.rawVizData;
  const {
    indexFields: { availableFields },
  } = data;
  const [configList, setConfigList] = useState<ConfigList>({});
  const [isAddConfigClicked, setIsAddConfigClicked] = useState<boolean>(false);
  const [selectedConfigItem, setSelectedConfigItem] = useState<SelectedConfigItem>({
    index: -1,
    name: '',
  });
  const { userConfigs } = data;

  useEffect(() => {
    if (userConfigs && userConfigs.dataConfig) {
      setConfigList({
        ...userConfigs.dataConfig,
      });
    }
  }, [userConfigs?.dataConfig, visualizations.vis.name]);

  const updateList = (value: string, field: string) => {
    if (value !== '') {
      const { index, name } = selectedConfigItem;
      const list = { ...configList };
      let listItem = { ...list[name][index] };
      listItem = {
        ...listItem,
        [field === 'custom_label' ? 'alias' : field]: value.trim(),
      };
      if (field === 'label') {
        listItem.name = value;
      }
      const updatedList = {
        ...list,
        [name]: [
          ...list[name].slice(0, index),
          listItem,
          ...list[name].slice(index + 1, list[name].length),
        ],
      };
      setConfigList(updatedList);
    }
  };

  const updateHistogramConfig = (configName: string, fieldName: string, value: string) => {
    const list = { ...configList };
    const listItem = { ...list[configName][0] };
    listItem[fieldName] = value;
    const updatedList = {
      ...list,
      [configName]: [listItem],
    };
    setConfigList(updatedList);
  };

  const handleServiceRemove = (index: number, name: string) => {
    const list = { ...configList };
    const arr = [...list[name]];
    arr.splice(index, 1);
    const updatedList = { ...list, [name]: arr };
    setConfigList(updatedList);
  };

  const handleServiceAdd = (name: string) => {
    setIsAddConfigClicked(true);
    const list = {
      ...configList,
      [name]: [
        ...configList[name],
        name === AGGREGATIONS ? initialSeriesEntry : initialDimensionEntry,
      ],
    };
    setSelectedConfigItem({ index: list[name].length - 1, name });
    setConfigList(list);
  };

  const updateChart = (updatedConfigList: ConfigList = configList) => {
    if (visualizations.vis.name === VIS_CHART_TYPES.Histogram) {
      dispatch(
        changeVizConfig({
          tabId,
          vizId: curVisId,
          data: {
            ...userConfigs,
            dataConfig: {
              ...userConfigs.dataConfig,
              [GROUPBY]: configList[GROUPBY],
              [AGGREGATIONS]: configList[AGGREGATIONS],
            },
          },
        })
      );
    } else {
      const statsTokens = qm.queryParser().parse(data.query.rawQuery).getStats();
      const newQuery = qm
        .queryBuilder()
        .build(data.query.rawQuery, composeAggregations(updatedConfigList, statsTokens));

      batch(async () => {
        await handleQueryChange(newQuery);
        await dispatch(
          changeQuery({
            tabId,
            query: {
              ...data.query,
              [RAW_QUERY]: newQuery,
            },
          })
        );
        await fetchData();
        await dispatch(
          changeVizConfig({
            tabId,
            vizId: visualizations.vis.name,
            data: {
              dataConfig: {
                ...userConfigs.dataConfig,
                [GROUPBY]: configList[GROUPBY],
                [AGGREGATIONS]: configList[AGGREGATIONS],
                breakdowns: updatedConfigList.breakdowns,
                span: updatedConfigList.span,
              },
            },
          })
        );
      });
    }
  };

  const isPositionButtonVisible = (sectionName: string) =>
    sectionName === AGGREGATIONS &&
    (visualizations.vis.name === VIS_CHART_TYPES.Line ||
      visualizations.vis.name === VIS_CHART_TYPES.Scatter);

  const getOptionsAvailable = (sectionName: string) => {
    const selectedFields = {};
    const unselectedFields = fieldOptionList.filter((field) => !selectedFields[field.label]);
    return sectionName === AGGREGATIONS
      ? unselectedFields
      : visualizations.vis.name === VIS_CHART_TYPES.Line ||
        visualizations.vis.name === VIS_CHART_TYPES.Scatter
      ? unselectedFields.filter((i) => i.type === 'timestamp')
      : unselectedFields;
  };

  const getCommonUI = (title: string) => {
    const { index, name } = selectedConfigItem;
    const selectedObj = configList[name][index];
    const isDimensions = name === DIMENSIONS;
    return (
      <>
        <div key={index} className="services">
          <div className="first-division">
            <DataConfigItemClickPanel
              isSecondary
              title={title}
              closeMenu={() => handleServiceEdit(true, -1, '')}
            />
            <EuiPanel color="subdued" style={{ padding: '0px' }}>
              {/* Aggregation input for Metrics */}
              {!isDimensions && (
                <EuiFormRow label="Aggregation">
                  <EuiComboBox
                    aria-label="Accessible screen reader label"
                    placeholder="Select a aggregation"
                    singleSelection={{ asPlainText: true }}
                    options={AGGREGATION_OPTIONS}
                    selectedOptions={
                      selectedObj.aggregation
                        ? [
                            {
                              label: selectedObj.aggregation,
                            },
                          ]
                        : []
                    }
                    onChange={(e) => updateList(e.length > 0 ? e[0].label : '', 'aggregation')}
                  />
                </EuiFormRow>
              )}
              {/* Show input fields for metrics when aggregation is not empty  */}
              {!isDimensions && selectedObj.aggregation !== '' && (
                <>
                  {getCommonDimensionsField(selectedObj, name)}
                  <EuiFormRow label="Custom label">
                    <EuiFieldText
                      placeholder="Custom label"
                      value={selectedObj.alias}
                      onChange={(e) => updateList(e.target.value, 'alias')}
                      aria-label="Use aria labels when no actual label is in use"
                    />
                  </EuiFormRow>
                </>
              )}
              {/* Show input fields for dimensions */}
              {isDimensions && getCommonDimensionsField(selectedObj, name)}
              {isPositionButtonVisible(name) && (
                <EuiFormRow label="Side">
                  <ButtonGroupItem
                    legend="Side"
                    groupOptions={[
                      { id: 'left', label: 'Left' },
                      { id: 'right', label: 'Right' },
                    ]}
                    idSelected={selectedObj.side || 'right'}
                    handleButtonChange={(id: string) => updateList(id, 'side')}
                  />
                </EuiFormRow>
              )}
            </EuiPanel>
            <EuiSpacer size="s" />
          </div>
        </div>
      </>
  );
  };
  const getCommonDimensionsField = (selectedObj: any, name: string) => (
    <EuiFormRow label="Field">
      <EuiComboBox
        aria-label="Accessible screen reader label"
        placeholder="Select a field"
        singleSelection={{ asPlainText: true }}
        options={getOptionsAvailable(name)}
        selectedOptions={
          selectedObj.label
            ? [
                {
                  label: selectedObj.label,
                },
              ]
            : []
        }
        onChange={(e) => updateList(e.length > 0 ? e[0].label : '', 'label')}
      />
    </EuiFormRow>
  );

  const getNumberField = (type: string) => (
    <>
      <EuiFieldNumber
        id={htmlIdGenerator('input-number')()}
        fullWidth
        placeholder="auto"
        value={
          configList[GROUPBY] && configList[GROUPBY].length > 0 && configList[GROUPBY][0][type]
            ? configList[GROUPBY][0][type]
            : ''
        }
        onChange={(e) => updateHistogramConfig(DIMENSIONS, type, e.target.value)}
        data-test-subj="valueFieldNumber"
      />
      <EuiSpacer size="s" />
    </>
  );

  const getBreakDownFields = useCallback(
    (configList: ConfigList) => {
      return configList[GROUPBY];
    },
    [configList[GROUPBY]]
  );

  const Breakdowns = useMemo(() => {
    return (
      <>
        <div className="services">
          <div className="first-division">
            <EuiPanel color="subdued" style={{ padding: '0px' }}>
              <EuiFormRow label="Fields">
                <EuiComboBox
                  aria-label="Accessible screen reader label"
                  placeholder="Select fields"
                  singleSelection={false}
                  options={configList[GROUPBY]}
                  selectedOptions={configList.breakdowns ?? []}
                  onChange={(fields) => {
                    setConfigList((staleState) => {
                      return {
                        ...staleState,
                        breakdowns: fields,
                      };
                    });
                  }}
                />
              </EuiFormRow>
            </EuiPanel>
          </div>
        </div>
      </>
    );
  }, [configList[GROUPBY], configList.breakdowns]);

  const DateHistogram = useMemo(() => {
    return (
      <>
        <div className="services">
          <div className="first-division">
            <EuiPanel color="subdued" style={{ padding: '0px' }}>
              <EuiFormRow label="Timestamp">
                <EuiComboBox
                  aria-label="Accessible screen reader label"
                  placeholder="Select fields"
                  singleSelection
                  options={availableFields
                    .filter((idxField) => idxField.type === TIMESTAMP)
                    .map((field) => ({ ...field, label: field.name }))}
                  selectedOptions={
                    configList.span?.time_field ? [...configList.span?.time_field] : []
                  }
                  onChange={(field) => {
                    setConfigList((staleState) => {
                      return {
                        ...staleState,
                        span: {
                          ...staleState.span,
                          time_field: field,
                        },
                      };
                    });
                  }}
                />
              </EuiFormRow>
              <EuiFormRow label="Interval">
                <EuiFieldNumber
                  placeholder="Placeholder text"
                  value={configList.span?.interval ?? 1}
                  min={1}
                  onChange={(e) => {
                    e.persist();
                    setConfigList((staleState) => {
                      return {
                        ...staleState,
                        span: {
                          ...staleState.span,
                          interval: e.target?.value ?? 1,
                        },
                      };
                    });
                  }}
                  aria-label="Use aria labels when no actual label is in use"
                />
              </EuiFormRow>
              <EuiFormRow label="Unit">
                <EuiComboBox
                  aria-label="Accessible screen reader label"
                  placeholder="Select fields"
                  singleSelection
                  options={TIME_INTERVAL_OPTIONS.map((option) => {
                    return {
                      ...option,
                      label: option.text,
                    };
                  })}
                  selectedOptions={configList.span?.unit ? [...configList.span?.unit] : []}
                  onChange={(unit) => {
                    setConfigList((staleState) => {
                      return {
                        ...staleState,
                        span: {
                          ...staleState.span,
                          unit,
                        },
                      };
                    });
                  }}
                />
              </EuiFormRow>
            </EuiPanel>
          </div>
        </div>
      </>
    );
  }, [availableFields, configList.span]);

  const getRenderFieldsObj = (sectionName: string, title: string) => {
    return {
      list: configList[sectionName],
      sectionName,
      title,
      visType: visualizations.vis.name,
      addButtonText: 'Click to add',
      handleServiceAdd,
      handleServiceRemove,
      handleServiceEdit,
    };
  };
  return isAddConfigClicked ? (
    getCommonUI(selectedConfigItem.name === METRICS ? SERIES : 'Dimensions')
  ) : (
    <>
      <EuiTitle size="xxs">
        <h3>Data Configurations</h3>
      </EuiTitle>
      <EuiSpacer size="s" />
      {visualizations.vis.name !== VIS_CHART_TYPES.Histogram ? (
        <>
          {DataConfigPanelFields(getRenderFieldsObj(METRICS, SERIES))}
          <EuiSpacer size="s" />
          {DataConfigPanelFields(getRenderFieldsObj(DIMENSIONS, 'Dimensions'))}
          <EuiSpacer size="s" />
          <EuiTitle size="xxs">
            <h3>Date Histogram</h3>
          </EuiTitle>
          {DateHistogram}
          {/* <EuiTitle size="xxs">
            <h3>Breakdowns</h3>
          </EuiTitle>
          {Breakdowns} */}
        </>
      ) : (
        <>
          <EuiTitle size="xxs">
            <h3>Bucket Size</h3>
          </EuiTitle>
          {getNumberField('bucketSize')}

          <EuiSpacer size="s" />
          <EuiTitle size="xxs">
            <h3>Bucket Offset</h3>
          </EuiTitle>
          {getNumberField('bucketOffset')}
        </>
      )}
      <EuiSpacer size="m" />
      <EuiFlexItem grow={false}>
        <EuiButton
          data-test-subj="visualizeEditorRenderButton"
          iconType="play"
          onClick={() => updateChart()}
          size="s"
        >
          Update chart
        </EuiButton>
      </EuiFlexItem>
    </>
  );
};
