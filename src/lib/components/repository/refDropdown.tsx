import React, {useEffect, useRef, useState} from "react";
import {ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, XIcon} from "@primer/octicons-react";
import {tags, branches, commits} from '../../api';
import {Nav, Badge,Form,Button,Alert,Overlay,Popover } from "react-bootstrap";
import {RefTypeBranch, RefTypeCommit, RefTypeTag} from "../../../constants";
import { CommitListProps, RefDropdownProps, RefEntryProps, RefSelectorProps, ref, RepoPaginatorProps, ResponseProps } from "../interface/comp_interface";
import { Commit } from "../../../pages/repositories/interface/repo_interface";


const RefSelector:React.FC<RefSelectorProps> = ({ repo, selected, selectRef, withCommits, withWorkspace, withTags, amount = 300 }) => {
    // used for ref pagination
    const [pagination, setPagination] = useState({after: "", prefix: "", amount});
    const [refList, setRefs] = useState<{loading: boolean, payload:ResponseProps | null, error:Error | null}>({loading: true, payload: null, error: null});
    const [refType, setRefType] = useState(selected && selected.type || RefTypeBranch)
    useEffect(() => {
        setRefs({loading: true, payload: null, error: null});
        const fetchRefs = async () => {
            try {
                let response;
                if (refType === RefTypeTag && repo.id) {
                    response = await tags.list(repo.id, pagination.prefix, pagination.after, pagination.amount);
                } else {
                    if(repo.id)
                    response = await branches.list(repo.id, pagination.prefix, pagination.after, pagination.amount);
                }
                setRefs({loading: false, payload: response, error: null});
            } catch (error) {
                setRefs({loading: false, payload: null, error: error as Error});
            }
        };
        fetchRefs();
    }, [refType, repo.id, pagination])

    // used for commit listing
    const initialCommitList = {branch: selected, commits: null, loading: false};
    const [commitList, setCommitList] = useState(initialCommitList);


    const form = (
        <div className="ref-filter-form">
            <Form onSubmit={e => { e.preventDefault(); }}>
                <Form.Control type="text" placeholder={refType === RefTypeTag ? "Filter tags" : "Filter branches"} onChange={(e)=> {
                    setPagination({
                        amount,
                        after: "",
                        prefix: e.target.value
                    })
                }}/>
            </Form>
        </div>
    );
    const refTypeNav = withTags && <Nav variant="tabs" onSelect={setRefType} activeKey={refType} className="mt-2">
        <Nav.Item>
            <Nav.Link eventKey={"branch"}>Branches</Nav.Link>
        </Nav.Item>
        <Nav.Item>
            <Nav.Link eventKey={"tag"}>Tags</Nav.Link>
        </Nav.Item>
    </Nav>

    if (refList.loading) {
        return  (
            <div className="ref-selector">
                {form}
                {refTypeNav}
                <p>Loading...</p>
            </div>
        );
    }

    if (refList.error) {
        return  (
            <div className="ref-selector">
                {form}
                {refTypeNav}
                <Alert variant="danger">{refList.error.message}</Alert>
            </div>
        );
    }

    if (commitList.commits !== null) {
        return (
            <CommitList
                withWorkspace={withWorkspace}
                commits={commitList.commits}
                branch={commitList.branch as string}
                selectRef={selectRef}
                reset={() => {
                    setCommitList(initialCommitList);
                }}/>
        )}


    const results = refList.payload? refList.payload.results: '';

    return (
        <div className="ref-selector">
            {form}
            {refTypeNav}
            <div className="ref-scroller">
                {(results && results.length > 0) ? (
                    <>
                        <ul className="list-group ref-list">
                            {results.map(namedRef => (
                                <RefEntry key={namedRef.id} repo={repo} refType={refType} namedRef={namedRef.id?namedRef.id:''} selectRef={selectRef} selected={selected as ref} withCommits={refType !== RefTypeTag && withCommits} logCommits={async () => {
                                    const data = await commits.log(repo.id?repo.id:'', namedRef.id?namedRef.id:'')
                                    setCommitList({...commitList, branch: namedRef.id?namedRef.id:'', commits: data.results});
                                }}/>
                            ))}
                        </ul>
                        <Paginator results={refList.payload? refList.payload.results : []} pagination={refList.payload? refList.payload.pagination:{}} from={pagination.after} onPaginate={(after) => {
                            setPagination({after , prefix: "", amount})
                        }}/>
                    </>
                ) : (
                    <p className="text-center mt-3"><small>No references found</small></p>
                )}

            </div>
        </div>
    );
};

const CommitList:React.FC<CommitListProps> = ({ commits, selectRef, reset, branch, withWorkspace }) => {
    const getMessage = (commit:Commit) => {
        if (!commit.message) {
            return 'repository epoch';
        }

        if (commit.message.length > 60) {
            return commit.message.substr(0, 40) + '...';
        }

        return commit.message;
    };

    return (
        <div className="ref-selector">
            <h5>{branch}</h5>
            <div className="ref-scroller">
                <ul className="list-group ref-list">
                    {(withWorkspace) ? (
                        <li className="list-group-item" key={branch}>
                            <Button variant="link" onClick={() => {
                                selectRef({id: branch, type: RefTypeBranch});
                            }}><em>{branch}{'\''}s Workspace (uncommitted changes)</em></Button>
                        </li>
                    ) : (<span/>)}
                    {commits.map(commit => (
                        <li className="list-group-item" key={commit.id}>
                            <Button variant="link" onClick={() => {
                                selectRef({id: commit.id, type: RefTypeCommit});
                            }}>{getMessage(commit)} </Button>
                            <div className="actions">
                                <Badge variant="light">{commit.id.substr(0, 12)}</Badge>
                            </div>
                        </li>
                    ))}
                </ul>
                <p className="ref-paginator">
                    <Button variant="link" size="sm" onClick={reset}>Back</Button>
                </p>
            </div>
        </div>
    );
};

const RefEntry:React.FC<RefEntryProps> = ({repo, namedRef, refType, selectRef, selected, logCommits, withCommits}) => {
    return (
        <li className="list-group-item" key={namedRef}>
            {(!!selected && namedRef === selected.id) ?
                <strong>{namedRef}</strong> :
                <Button variant="link" onClick={() => {
                    selectRef({id: namedRef, type: refType});
                }}>{namedRef}</Button>
            }
            <div className="actions">
                {(refType === RefTypeBranch && namedRef === repo.default_branch) ? (<Badge variant="info">Default</Badge>) : <span/>}
                {(withCommits) ? (
                    <Button onClick={logCommits} size="sm" variant="link">
                        <ChevronRightIcon/>
                    </Button>
                ) : (<span/>)}
            </div>
        </li>
    );
};

const Paginator:React.FC<RepoPaginatorProps> = ({ pagination, onPaginate, results, from }) => {
    const next = (results.length) ? results[results.length-1].id : "";

    if (!pagination.has_more && from === "") return (<span/>);

    return (
        <p className="ref-paginator">
            {(from !== "") ?
                (<Button  size={"sm"} variant="link" onClick={() => { onPaginate(""); }}>Reset</Button>) :
                (<span/>)
            }
            {' '}
            {(pagination.has_more) ?
                (<Button size={"sm"} variant="link" onClick={() => { onPaginate(next?next:''); }}>Next...</Button>) :
                (<span/>)
            }
        </p>
    );
};

const RefDropdown:React.FC<RefDropdownProps> = ({ repo, selected, selectRef, onCancel, variant="light", prefix = '', emptyText = '', withCommits = true, withWorkspace = true, withTags = true }) => {

    const [show, setShow] = useState(false);
    const target = useRef(null);


    const popover = (
        <Overlay target={target.current} show={show} placement="bottom" rootClose={true} onHide={() => setShow(false)}>
            <Popover className="ref-popover">
                <Popover.Body>
                    <RefSelector
                        repo={repo}
                        withCommits={withCommits}
                        withWorkspace={withWorkspace}
                        withTags={withTags}
                        selected={selected}
                        selectRef={(ref) => {
                            selectRef(ref);
                            setShow(false);
                        }}/>
                </Popover.Body>
            </Popover>
        </Overlay>
    );

    const cancelButton = (!!onCancel && !!selected) ? (<Button onClick={() => {
        setShow(false);
        onCancel();
    }} variant={variant}><XIcon/></Button>) : (<span/>);

    if (!selected) {
        return (
            <>
                <Button ref={target} variant={variant} onClick={()=> { setShow(!show) }}>
                    {emptyText} {show ? <ChevronUpIcon/> : <ChevronDownIcon/>}
                </Button>
                {cancelButton}
                {popover}
            </>
        );
    }

    const showId = (ref:ref) => {
        if (!ref)
            return ''
        if (ref.type === RefTypeCommit)
            return ref.id.substr(0, 12)
        return ref.id
    }

    const title = prefix + (!!selected) ? `${prefix} ${selected.type}: ` : '';
    return (
        <>
            <Button ref={target} variant={variant} onClick={()=> { setShow(!show) }}>
                {title} <strong>{showId(selected)}</strong> {show ? <ChevronUpIcon/> : <ChevronDownIcon/>}
            </Button>
            {cancelButton}
            {popover}
        </>
    );
};

export default RefDropdown;
