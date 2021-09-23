import {
  CopyOutlined,
  DeleteOutlined,
  FolderAddOutlined,
  HomeOutlined,
  ScissorOutlined,
  SnippetsOutlined
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Col,
  Input,
  Layout,
  Menu,
  notification,
  Row,
  Space,
  TablePaginationConfig,
  Typography
} from 'antd'
import { FilterValue, SorterResult, TableCurrentDataSource } from 'antd/lib/table/interface'
import prettyBytes from 'pretty-bytes'
import qs from 'qs'
import React, { useEffect, useState } from 'react'
import { RouteComponentProps, useHistory } from 'react-router'
import { Link } from 'react-router-dom'
import useSWR from 'swr'
import useSWRImmutable from 'swr/immutable'
import { fetcher, req } from '../../utils/Fetcher'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import AddFolder from './components/AddFolder'
import Breadcrumb from './components/Breadcrumb'
import Remove from './components/Remove'
import Rename from './components/Rename'
import Share from './components/Share'
import TableFiles from './components/TableFiles'
import Upload from './components/Upload'

interface PageProps extends RouteComponentProps<{
  type?: string
}> {}

const Dashboard: React.FC<PageProps> = ({ match }) => {
  const PAGE_SIZE = 10

  const history = useHistory()
  const [parent, setParent] = useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null, name: string | React.ReactElement }>>([{ id: null, name: <><HomeOutlined /> Home</> }])
  const [data, setData] = useState<any[]>([])
  const [dataChanges, setDataChanges] = useState<{ pagination?: TablePaginationConfig, filters?: Record<string, FilterValue | null>, sorter?: SorterResult<any> | SorterResult<any>[] }>()
  const [selected, setSelected] = useState<any[]>([])
  const [action, setAction] = useState<string>()
  const [selectShare, setSelectShare] = useState<any>()
  const [selectDeleted, setSelectDeleted] = useState<any>()
  const [keyword, setKeyword] = useState<string>()
  const [tab, setTab] = useState<string | undefined>(match.params.type)
  const [params, setParams] = useState<any>()
  const [loadingPaste, setLoadingPaste] = useState<boolean>()
  const [addFolder, setAddFolder] = useState<boolean>()
  const [fileRename, setFileRename] = useState<any>()
  const [scrollTop, setScrollTop] = useState<number>(0)
  const [fileList, setFileList] = useState<any[]>(JSON.parse(localStorage.getItem('fileList') || '[]'))

  const { data: me, error: errorMe } = useSWRImmutable('/users/me', fetcher)
  const { data: filesUpload } = useSWR(fileList?.filter(file => file.response?.file)?.length
    ? `/files?sort=created_at:desc&id.in=(${fileList?.filter(file => file.response?.file).map(file => `'${file.response.file.id}'`).join(',')})` : null, fetcher, {
    refreshInterval: 5000
  })
  const { data: files, mutate: refetch } = useSWR(params ? `/files?${qs.stringify(params)}` : null, fetcher, { onSuccess: files => {
    if (files?.files) {
      if (!params?.skip || !dataChanges?.pagination?.current || dataChanges?.pagination?.current === 1) {
        return setData(files.files.map((file: any) => ({ ...file, key: file.id })))
      }
      const filters = [
        ...data.map(row => files.files.find((file: any) => file.id === row.id) || row).map(file => ({ ...file, key: file.id })),
        ...files.files.map((file: any) => ({ ...file, key: file.id }))
      ].reduce((res, row) => [
        ...res, !res.filter(Boolean).find((r: any) => r.id === row.id) ? row : null
      ], []).filter(Boolean)
      setData(filters)
    }
  } })

  useEffect(() => {
    if (errorMe) {
      history.replace('/login')
    }
  }, [errorMe])

  useEffect(() => {
    fetch({}, {}, { column: { key: 'uploaded_at' }, order: 'descend' })
  }, [])

  useEffect(() => {
    const nextPage = () => {
      setScrollTop(document.body.scrollTop)
    }
    nextPage()
    document.body.addEventListener('scroll', nextPage)
  }, [])

  useEffect(() => {
    if (scrollTop === document.body.scrollHeight - document.body.clientHeight && files?.files.length >= PAGE_SIZE) {
      change({ ...dataChanges?.pagination, current: (dataChanges?.pagination?.current || 1) + 1 }, dataChanges?.filters, dataChanges?.sorter)
    }
  }, [scrollTop])

  useEffect(() => {
    localStorage.setItem('fileList', JSON.stringify(fileList || []))
  }, [fileList])

  useEffect(() => {
    change({ ...dataChanges?.pagination, current: 1 }, dataChanges?.filters, dataChanges?.sorter)
    setScrollTop(0)
  }, [keyword, parent])


  useEffect(() => {
    history.replace(`/dashboard${tab === 'shared' ? '/shared' : ''}`)
    setBreadcrumbs(breadcrumbs.slice(0, 1))
    if (parent !== null) {
      setParent(null)
    } else {
      change({ ...dataChanges?.pagination, current: 1 }, dataChanges?.filters, dataChanges?.sorter)
      setScrollTop(0)
    }
  }, [tab])

  useEffect(() => {
    if (action === 'copy') {
      notification.info({
        message: 'Ready to copy',
        description: 'Please select a folder to copy these files.'
      })
    } else if (action === 'cut') {
      notification.info({
        message: 'Ready to move',
        description: 'Please select a folder to move these files to.'
      })
    }
  }, [action])

  useEffect(() => {
    if (filesUpload?.files) {
      const list = fileList?.map(file => {
        if (!file.response?.file.id) return file
        const found = filesUpload.files.find((f: any) => f.id === file.response?.file.id)
        if (!found) {
          return null
        }
        const getPercent = (fixed?: number) => found.upload_progress !== null ? Number(found.upload_progress * 100).toFixed(fixed) : 100
        return {
          ...file,
          name: `${getPercent(2)}% ${found.name} (${prettyBytes(found.size)})`,
          percent: getPercent(),
          status: found.upload_progress !== null ? 'uploading' : 'success',
          url: found.upload_progress === null ? `/view/${found.id}` : undefined,
          response: { file: found }
        }
      }).filter(file => file && file?.status !== 'success')
      setFileList(list)
      setData([...filesUpload.files?.map((file: any) => ({ ...file, key: file.id })), ...data].reduce((res, row) => [
        ...res, !res.filter(Boolean).find((r: any) => r.id === row.id) ? row : null
      ], []).filter(Boolean))
    }
  }, [filesUpload])

  const fetch = (pagination?: TablePaginationConfig, filters?: Record<string, FilterValue | null>, sorter?: SorterResult<any> | SorterResult<any>[]) => {
    setParams({
      ...parent ? { parent_id: parent } : { 'parent_id.is': 'null' },
      ...keyword ? { 'name.ilike': `'%${keyword}%'` } : {},
      ...tab === 'shared' ? { shared: 1, 'parent_id.is': undefined } : {},
      take: PAGE_SIZE,
      skip: ((pagination?.current || 1) - 1) * PAGE_SIZE,
      ...Object.keys(filters || {})?.reduce((res, key: string) => {
        return { ...res, ...filters?.[key]?.[0] !== undefined ? { [`${key}.in`]: `(${filters[key]?.map(val => `'${val}'`).join(',')})` } : {} }
      }, {}),
      ...(sorter as SorterResult<any>)?.order ? {
        sort: `${(sorter as SorterResult<any>).column?.dataIndex}:${(sorter as SorterResult<any>).order?.replace(/end$/gi, '')}`
      } : { sort: 'created_at:desc' },
    })
  }

  const change = async (pagination?: TablePaginationConfig, filters?: Record<string, FilterValue | null>, sorter?: SorterResult<any> | SorterResult<any>[], _?: TableCurrentDataSource<any>) => {
    setDataChanges({ pagination, filters, sorter })
    fetch(pagination, filters, sorter)
  }

  const paste = async (rows: any[]) => {
    rows = rows?.filter(row => row.id !== parent)
    setLoadingPaste(true)
    try {
      if (action === 'copy') {
        await Promise.all(rows?.map(async row => await req.post('/files', { file: { ...row, parent_id: parent, id: undefined } })))
      } else if (action === 'cut') {
        await Promise.all(rows?.map(async row => await req.patch(`/files/${row.id}`, { file: { parent_id: parent } })))
      }
    } catch (error) {
      // ignore
    }
    // refetch()
    if ((dataChanges?.pagination?.current || 0) > 1) {
      change({ ...dataChanges?.pagination, current: 1 }, dataChanges?.filters, dataChanges?.sorter)
    } else {
      refetch()
    }
    setSelected([])
    setLoadingPaste(false)
    notification.success({
      message: 'Success',
      description: `Files are ${action === 'cut' ? 'moved' : 'copied'} successfully!`
    })
    setAction(undefined)
  }



  return <>
    <Navbar user={me?.user} />
    <Layout.Content className="container" style={{ paddingTop: 0 }}>
      <Row>
        <Col lg={{ span: 18, offset: 3 }} md={{ span: 20, offset: 2 }} span={24}>
          <Typography.Paragraph>
            <Menu mode="horizontal" selectedKeys={[params?.shared ? 'shared' : 'mine']} onClick={({ key }) => setTab(key === 'mine' ? undefined : key)}>
              <Menu.Item disabled={!files} key="mine">My Files</Menu.Item>
              <Menu.Item disabled={!files} key="shared">Shared</Menu.Item>
            </Menu>
          </Typography.Paragraph>
          <Typography.Paragraph>
            {!tab ? <Upload
              onCancel={file => setSelectDeleted([file])}
              parent={parent}
              dataFileList={[fileList, setFileList]} /> : <Alert
              message={<>
                These are all files that other users share with you. If you find any suspicious/spam/sensitive/etc content, please <Link to="/contact?intent=report">report it to us</Link>.
              </>}
              type="warning"
              showIcon
              closable/>}
          </Typography.Paragraph>
          <Typography.Paragraph style={{ float: 'left' }}>
            <Breadcrumb dataSource={[breadcrumbs, setBreadcrumbs]} dataParent={[parent, setParent]} />
          </Typography.Paragraph>
          <Typography.Paragraph style={{ textAlign: 'right' }}>
            <Space wrap>
              {!tab ? <>
                <Button shape="circle" icon={<FolderAddOutlined />} onClick={() => setAddFolder(true)} />
                <Button shape="circle" icon={<CopyOutlined />} disabled={!selected?.length} onClick={() => setAction('copy')} />
                <Button shape="circle" icon={<ScissorOutlined />} disabled={!selected?.length} onClick={() => setAction('cut')} />
                <Button shape="circle" icon={<SnippetsOutlined />} disabled={!action} loading={loadingPaste} onClick={() => paste(selected)} />
                <Button shape="circle" icon={<DeleteOutlined />} danger type="primary" disabled={!selected?.length} onClick={() => setSelectDeleted(selected)} />
              </> : ''}
              <Input.Search className="input-search-round" placeholder="Search..." enterButton onSearch={setKeyword} allowClear />
            </Space>
          </Typography.Paragraph>
          <TableFiles
            files={files}
            tab={tab}
            onChange={change}
            onDelete={row => selectDeleted([row])}
            onRename={row => setFileRename(row)}
            onShare={row => setSelectShare(row)}
            onRowClick={row => {
              if (row.type === 'folder') {
                setParent(row.id)
                setBreadcrumbs([...breadcrumbs, { id: row.id, name: row.name }])
              } else {
                history.push(`/view/${row.id}`)
              }
            }}
            dataSource={data}
            sorterData={dataChanges?.sorter as SorterResult<any>}
            dataSelect={[selected, setSelected]} />
        </Col>
      </Row>

      <Remove
        dataSource={[data, setData]}
        dataSelect={[selectDeleted, setSelectDeleted]}
        onFinish={newData => {
          if (!newData?.length) {
            if ((dataChanges?.pagination?.current || 0) > 1) {
              change({ ...dataChanges?.pagination, current: 1 }, dataChanges?.filters, dataChanges?.sorter)
            } else {
              refetch()
            }
          }
          setSelected([])
        }} />

      <AddFolder
        dataSource={[data, setData]}
        dataActivate={[addFolder, setAddFolder]}
        parent={parent} />

      <Rename
        dataSource={[data, setData]}
        dataSelect={[fileRename, setFileRename]} />

      <Share
        me={me}
        dataSource={[data, setData]}
        dataSelect={[selectShare, setSelectShare]} />
    </Layout.Content>
    <Footer />
  </>
}

export default Dashboard